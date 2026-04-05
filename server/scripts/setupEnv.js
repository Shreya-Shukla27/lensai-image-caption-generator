const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createInterface } = require('readline/promises');
const { stdin, stdout } = require('process');

const envPath = path.resolve(__dirname, '..', '.env');
const examplePath = path.resolve(__dirname, '..', '.env.example');

const requiredKeys = [
  'MONGO_URI',
  'CLOUD_NAME',
  'CLOUD_API_KEY',
  'CLOUD_API_SECRET',
  'HF_TOKEN',
  'JWT_SECRET',
  'CLIENT_URLS',
  'PORT',
];

const placeholderRegex = {
  MONGO_URI: /username:password|cluster\.mongodb\.net\/lensai/i,
  CLOUD_NAME: /your_cloud_name/i,
  CLOUD_API_KEY: /your_cloud_api_key/i,
  CLOUD_API_SECRET: /your_cloud_api_secret/i,
  HF_TOKEN: /hf_your_token_here/i,
  JWT_SECRET: /replace_with_a_long_random_secret/i,
};

const createInitialEnv = () => {
  if (fs.existsSync(envPath)) {
    return;
  }

  if (fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, envPath);
  } else {
    fs.writeFileSync(envPath, '', 'utf8');
  }
};

const readEnvMap = (content) => {
  const map = new Map();
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    if (!line || line.trim().startsWith('#') || !line.includes('=')) {
      continue;
    }

    const index = line.indexOf('=');
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1);
    map.set(key, value);
  }

  return map;
};

const upsertEnvValue = (content, key, value) => {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lineRegex = new RegExp(`^${escapedKey}=.*$`, 'm');
  const line = `${key}=${value}`;

  if (lineRegex.test(content)) {
    return content.replace(lineRegex, line);
  }

  const suffix = content.endsWith('\n') || content.length === 0 ? '' : '\n';
  return `${content}${suffix}${line}\n`;
};

const shouldPromptForKey = (key, value) => {
  if (!value || !value.trim()) {
    return true;
  }

  const pattern = placeholderRegex[key];
  return pattern ? pattern.test(value) : false;
};

const promptValue = async (rl, key, currentValue) => {
  if (key === 'JWT_SECRET' && shouldPromptForKey(key, currentValue)) {
    const generated = crypto.randomBytes(48).toString('hex');
    console.log('Generated secure JWT_SECRET automatically.');
    return generated;
  }

  const showCurrent = currentValue && currentValue.trim() ? ' (press Enter to keep current value)' : '';

  while (true) {
    const answer = await rl.question(`Enter ${key}${showCurrent}: `);
    const trimmed = answer.trim();

    if (trimmed) {
      return trimmed;
    }

    if (currentValue && currentValue.trim()) {
      return currentValue;
    }

    console.log(`${key} is required.`);
  }
};

const main = async () => {
  createInitialEnv();

  let envContent = fs.readFileSync(envPath, 'utf8');
  const envMap = readEnvMap(envContent);

  const rl = createInterface({ input: stdin, output: stdout });

  try {
    for (const key of requiredKeys) {
      const currentValue = envMap.get(key) || '';
      if (!shouldPromptForKey(key, currentValue)) {
        continue;
      }

      const value = await promptValue(rl, key, currentValue);
      envContent = upsertEnvValue(envContent, key, value);
      envMap.set(key, value);
    }
  } finally {
    rl.close();
  }

  fs.writeFileSync(envPath, envContent, 'utf8');
  console.log(`Updated ${envPath}`);
  console.log('Run npm run check-env next.');
};

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
