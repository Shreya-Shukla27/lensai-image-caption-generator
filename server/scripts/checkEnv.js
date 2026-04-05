require('dotenv').config();

const requiredVars = [
  'MONGO_URI',
  'CLOUD_NAME',
  'CLOUD_API_KEY',
  'CLOUD_API_SECRET',
  'HF_TOKEN',
  'JWT_SECRET',
];

const allowedNodeEnvs = ['development', 'test', 'production'];
const nodeEnv = (process.env.NODE_ENV || '').trim();
const isProduction = nodeEnv === 'production';

if (nodeEnv && !allowedNodeEnvs.includes(nodeEnv)) {
  console.error(`Invalid NODE_ENV value: ${nodeEnv}`);
  process.exit(1);
}

const missing = requiredVars.filter((key) => !process.env[key] || !process.env[key].trim());

const placeholderPatterns = {
  MONGO_URI: [/username:password/i, /cluster\.mongodb\.net\/lensai/i],
  CLOUD_NAME: [/your_cloud_name/i],
  CLOUD_API_KEY: [/your_cloud_api_key/i],
  CLOUD_API_SECRET: [/your_cloud_api_secret/i],
  HF_TOKEN: [/hf_your_token_here/i],
  JWT_SECRET: [/replace_with_a_long_random_secret/i],
};

const placeholderValues = requiredVars.filter((key) => {
  const value = process.env[key] || '';
  const patterns = placeholderPatterns[key] || [];
  return patterns.some((pattern) => pattern.test(value));
});

if (missing.length > 0) {
  console.error('Missing required environment variables:');
  missing.forEach((key) => console.error(`- ${key}`));
  process.exit(1);
}

if (placeholderValues.length > 0) {
  console.error('Replace placeholder values before running the server:');
  placeholderValues.forEach((key) => console.error(`- ${key}`));
  process.exit(1);
}

const clientUrlsRaw = process.env.CLIENT_URLS || process.env.CLIENT_URL || '';
const clientUrls = clientUrlsRaw
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);

if (clientUrls.length === 0) {
  if (isProduction) {
    console.error('CLIENT_URLS is required in production.');
    process.exit(1);
  }

  console.warn('Warning: CLIENT_URLS/CLIENT_URL is not set. CORS may block browser requests.');
} else {
  console.log(`CORS origins configured: ${clientUrls.length}`);
}

const placeholderOriginPatterns = [/your-app/i, /your-vercel-app/i, /your-netlify-app/i];
const placeholderOrigins = clientUrls.filter((url) =>
  placeholderOriginPatterns.some((pattern) => pattern.test(url))
);

if (placeholderOrigins.length > 0) {
  console.error('Replace placeholder domains in CLIENT_URLS:');
  placeholderOrigins.forEach((origin) => console.error(`- ${origin}`));
  process.exit(1);
}

if (isProduction) {
  const localOrigins = clientUrls.filter((url) => /localhost|127\.0\.0\.1/i.test(url));
  if (localOrigins.length > 0) {
    console.error('Remove localhost origins from CLIENT_URLS in production:');
    localOrigins.forEach((origin) => console.error(`- ${origin}`));
    process.exit(1);
  }

  const insecureOrigins = clientUrls.filter((url) => /^http:\/\//i.test(url));
  if (insecureOrigins.length > 0) {
    console.error('Use HTTPS origins in production CLIENT_URLS:');
    insecureOrigins.forEach((origin) => console.error(`- ${origin}`));
    process.exit(1);
  }

  if (/mongodb\.net\/\?/.test(process.env.MONGO_URI || '')) {
    console.error('MONGO_URI must include a database name in production (example: /lensai).');
    process.exit(1);
  }
}

console.log('Environment validation passed.');
