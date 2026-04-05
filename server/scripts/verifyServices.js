require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const { HfInference } = require('@huggingface/inference');
const { cloudinary } = require('../config/cloudinary');

const HF_VISION_MODEL = process.env.HF_VISION_MODEL || 'Qwen/Qwen3-VL-8B-Instruct';
const HF_PROVIDERS = (process.env.HF_PROVIDERS || 'together,novita')
  .split(',')
  .map((provider) => provider.trim())
  .filter(Boolean);

const requiredVars = [
  'MONGO_URI',
  'CLOUD_NAME',
  'CLOUD_API_KEY',
  'CLOUD_API_SECRET',
  'HF_TOKEN',
  'JWT_SECRET',
];

const placeholderPatterns = {
  MONGO_URI: [/username:password/i, /cluster\.mongodb\.net\/lensai/i],
  CLOUD_NAME: [/your_cloud_name/i],
  CLOUD_API_KEY: [/your_cloud_api_key/i],
  CLOUD_API_SECRET: [/your_cloud_api_secret/i],
  HF_TOKEN: [/hf_your_token_here/i],
  JWT_SECRET: [/replace_with_a_long_random_secret/i],
};

const missing = requiredVars.filter((key) => !process.env[key] || !process.env[key].trim());
const placeholders = requiredVars.filter((key) => {
  const value = process.env[key] || '';
  const patterns = placeholderPatterns[key] || [];
  return patterns.some((pattern) => pattern.test(value));
});

if (missing.length > 0 || placeholders.length > 0) {
  console.error('Environment is not ready yet.');

  if (missing.length > 0) {
    console.error('Missing values:');
    missing.forEach((key) => console.error(`- ${key}`));
  }

  if (placeholders.length > 0) {
    console.error('Placeholder values still present:');
    placeholders.forEach((key) => console.error(`- ${key}`));
  }

  process.exit(1);
}

const results = [];

const pushResult = (name, ok, details) => {
  results.push({ name, ok, details });
  const status = ok ? 'PASS' : 'FAIL';
  console.log(`${status}: ${name}${details ? ` - ${details}` : ''}`);
};

const verifyMongo = async () => {
  const conn = await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 8000,
  });

  const dbName = conn?.connection?.name || 'connected';
  await mongoose.disconnect();
  return `database=${dbName}`;
};

const verifyCloudinary = async () => {
  const tinyPngDataUri =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X3f0AAAAASUVORK5CYII=';
  const uploadFolder = 'image-captions';

  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = { timestamp, folder: uploadFolder };

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUD_API_SECRET
  );

  const payload = new URLSearchParams();
  payload.set('file', tinyPngDataUri);
  payload.set('api_key', process.env.CLOUD_API_KEY);
  payload.set('timestamp', String(timestamp));
  payload.set('folder', uploadFolder);
  payload.set('signature', signature);

  const uploadUrl = `https://api.cloudinary.com/v1_1/${process.env.CLOUD_NAME}/image/upload`;

  let uploaded;
  try {
    const response = await axios.post(uploadUrl, payload, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
    });
    uploaded = response.data;
  } catch (err) {
    const message = err.response?.data?.error?.message || err.message;
    throw new Error(message);
  }

  if (!uploaded?.secure_url || !uploaded?.public_id) {
    throw new Error('upload succeeded but response is incomplete');
  }

  await cloudinary.uploader.destroy(uploaded.public_id);
  return 'upload + delete permissions valid';
};

const verifyHuggingFace = async () => {
  const sampleImageUrl = 'https://picsum.photos/320/240.jpg';
  const hf = new HfInference(process.env.HF_TOKEN);
  let lastError = null;

  for (const provider of HF_PROVIDERS) {
    try {
      const response = await hf.chatCompletion({
        model: HF_VISION_MODEL,
        provider,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Write a short caption.' },
              { type: 'image_url', image_url: { url: sampleImageUrl } },
            ],
          },
        ],
        max_tokens: 40,
        temperature: 0.2,
      });

      const caption = response?.choices?.[0]?.message?.content?.trim();
      if (!caption) {
        throw new Error('caption response is empty');
      }

      return `inference valid (provider=${provider})`;
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(lastError?.message || 'inference request failed');
};

(async () => {
  try {
    const mongoDetails = await verifyMongo();
    pushResult('MongoDB', true, mongoDetails);
  } catch (err) {
    pushResult('MongoDB', false, err.message);
  }

  try {
    const cloudinaryDetails = await verifyCloudinary();
    pushResult('Cloudinary', true, cloudinaryDetails);
  } catch (err) {
    pushResult('Cloudinary', false, err.message);
  }

  try {
    const hfDetails = await verifyHuggingFace();
    pushResult('HuggingFace', true, hfDetails);
  } catch (err) {
    pushResult('HuggingFace', false, err.message);
  }

  const failed = results.filter((item) => !item.ok);
  if (failed.length > 0) {
    console.error(`Verification failed (${failed.length}/${results.length} checks).`);
    process.exit(1);
  }

  console.log('All service checks passed.');
})();
