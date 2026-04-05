const crypto = require('crypto');

const apiBase = (process.env.API_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');

const parseJson = async (res) => {
  try {
    return await res.json();
  } catch {
    return null;
  }
};

const assertOk = async (res, context) => {
  if (res.ok) {
    return res;
  }

  const text = await res.text().catch(() => '');
  throw new Error(`${context} failed (${res.status}): ${text}`);
};

const randomEmail = () => {
  const suffix = crypto.randomBytes(4).toString('hex');
  return `smoke_${Date.now()}_${suffix}@example.com`;
};

(async () => {
  const email = randomEmail();
  const password = `Smoke#${crypto.randomBytes(6).toString('hex')}`;

  // 1) Health
  const healthRes = await fetch(`${apiBase}/api/health`);
  await assertOk(healthRes, 'Health check');
  const healthData = await parseJson(healthRes);
  if (healthData?.status !== 'ok') {
    throw new Error(`Health payload mismatch: ${JSON.stringify(healthData)}`);
  }
  console.log('PASS: health');

  // 2) Register user
  const registerRes = await fetch(`${apiBase}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Smoke User',
      email,
      password,
    }),
  });
  await assertOk(registerRes, 'Register');
  const registerData = await parseJson(registerRes);
  const token = registerData?.token;
  if (!token) {
    throw new Error('Register response missing token');
  }
  console.log('PASS: register');

  // 3) Caption generation (authenticated, so it should save to history)
  const imageRes = await fetch('https://picsum.photos/400/300.jpg');
  await assertOk(imageRes, 'Sample image fetch');
  const imgType = imageRes.headers.get('content-type') || 'image/jpeg';
  const imgBuffer = await imageRes.arrayBuffer();
  const imageBlob = new Blob([imgBuffer], { type: imgType });

  const form = new FormData();
  form.set('image', imageBlob, 'smoke-test.jpg');
  form.set('tone', 'neutral');

  const captionRes = await fetch(`${apiBase}/api/caption`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });
  await assertOk(captionRes, 'Caption generate');
  const captionData = await parseJson(captionRes);
  if (!captionData?.caption) {
    throw new Error(`Caption response missing caption: ${JSON.stringify(captionData)}`);
  }
  if (!captionData?.id) {
    throw new Error(
      `Caption was generated but not saved (missing id): ${JSON.stringify(captionData)}`
    );
  }
  const captionId = captionData.id;
  console.log('PASS: caption generate + save');

  // 4) History includes new caption
  const historyRes = await fetch(`${apiBase}/api/caption/history`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await assertOk(historyRes, 'History fetch');
  const historyData = await parseJson(historyRes);
  if (!Array.isArray(historyData)) {
    throw new Error(`History payload invalid: ${JSON.stringify(historyData)}`);
  }

  const existsInHistory = historyData.some((item) => String(item._id) === String(captionId));
  if (!existsInHistory) {
    throw new Error('Generated caption id not found in history');
  }
  console.log('PASS: history contains new caption');

  // 5) Delete caption
  const deleteRes = await fetch(`${apiBase}/api/caption/${captionId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  await assertOk(deleteRes, 'Delete caption');
  console.log('PASS: delete caption');

  // 6) History no longer contains caption
  const historyAfterRes = await fetch(`${apiBase}/api/caption/history`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await assertOk(historyAfterRes, 'History refetch');
  const historyAfterData = await parseJson(historyAfterRes);
  if (!Array.isArray(historyAfterData)) {
    throw new Error(`History refetch payload invalid: ${JSON.stringify(historyAfterData)}`);
  }

  const stillExists = historyAfterData.some((item) => String(item._id) === String(captionId));
  if (stillExists) {
    throw new Error('Caption still present in history after delete');
  }
  console.log('PASS: history delete reflected');

  console.log('All full smoke tests passed.');
})().catch((err) => {
  console.error(`FAIL: ${err.message}`);
  process.exit(1);
});
