const axios = require('axios');

const apiBase = (process.env.API_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');

const tests = [
  {
    name: 'Health check',
    run: async () => {
      const res = await axios.get(`${apiBase}/api/health`, { timeout: 8000 });
      if (res.status !== 200 || res.data?.status !== 'ok') {
        throw new Error(`Unexpected response: ${res.status} ${JSON.stringify(res.data)}`);
      }
    },
  },
  {
    name: 'Caption route validation',
    run: async () => {
      try {
        await axios.post(`${apiBase}/api/caption`, null, { timeout: 8000 });
        throw new Error('Expected 400 response for missing image, but request succeeded');
      } catch (err) {
        const status = err.response?.status;
        if (status !== 400) {
          throw new Error(`Expected 400, got ${status || 'no status'}`);
        }
      }
    },
  },
  {
    name: 'Auth route validation',
    run: async () => {
      try {
        await axios.post(`${apiBase}/api/auth/register`, {}, { timeout: 8000 });
        throw new Error('Expected 400 response for invalid payload, but request succeeded');
      } catch (err) {
        const status = err.response?.status;
        if (status !== 400) {
          throw new Error(`Expected 400, got ${status || 'no status'}`);
        }
      }
    },
  },
];

const describeError = (err) => {
  if (!err) {
    return 'Unknown error';
  }

  if (err.name === 'AggregateError' && Array.isArray(err.errors) && err.errors.length > 0) {
    const first = err.errors[0];
    if (first?.code && first?.message) {
      return `${first.code}: ${first.message}`;
    }
    return first?.message || 'AggregateError';
  }

  const status = err.response?.status;
  const data = err.response?.data;
  const code = err.code;
  const message = err.message;

  if (status) {
    return `HTTP ${status}: ${JSON.stringify(data)}`;
  }

  if (code) {
    return message ? `${code}: ${message}` : code;
  }

  if (message) {
    return message;
  }

  return String(err);
};

(async () => {
  let passed = 0;

  for (const test of tests) {
    try {
      await test.run();
      console.log(`PASS: ${test.name}`);
      passed += 1;
    } catch (err) {
      console.error(`FAIL: ${test.name}`);
      console.error(`  ${describeError(err)}`);
      process.exitCode = 1;
      break;
    }
  }

  if (passed === tests.length) {
    console.log(`All smoke tests passed (${passed}/${tests.length}).`);
  }
})();
