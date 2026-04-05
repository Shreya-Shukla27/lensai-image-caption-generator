# Go-Live Checklist

## 1. Security First

- Rotate all secrets before production deployment.
- Never commit `.env` files.
- Confirm `.env` files are ignored by git.

## 2. Backend Deploy (Render)

- Deploy backend from this repo.
- Configure env vars:
  - `MONGO_URI`
  - `CLOUD_NAME`
  - `CLOUD_API_KEY`
  - `CLOUD_API_SECRET`
  - `HF_TOKEN`
  - `HF_VISION_MODEL` (optional)
  - `HF_PROVIDERS` (optional)
  - `JWT_SECRET`
  - `CLIENT_URLS` (set final frontend domain)
- Verify Render service is healthy at `/api/health`.

## 3. Frontend Deploy (Vercel/Netlify)

- Set `VITE_API_URL` to backend base URL.
- Build and deploy frontend.
- Confirm app loads and can call backend.

## 4. Automated Verification

Run from `server` locally against deployed backend:

```bash
API_BASE_URL=https://your-backend.onrender.com npm run smoke-api
API_BASE_URL=https://your-backend.onrender.com npm run smoke-full
```

PowerShell equivalent:

```powershell
$env:API_BASE_URL="https://your-backend.onrender.com"
npm run smoke-api
npm run smoke-full
```

Expected: all checks pass.

## 5. Manual Sanity Pass

- Register a new user.
- Login with that user.
- Generate a caption from an image.
- Confirm caption appears in history.
- Delete the history item.
- Confirm item is removed.
- Verify logout/login still works.

## 6. Production CORS Cleanup

- Remove placeholder domains from `CLIENT_URLS`.
- Prefer exact frontend domains over broad wildcards unless previews are required.

## 7. Post-Release Monitoring

- Watch Render logs for 5xx errors.
- Check Cloudinary usage and failed upload events.
- Check MongoDB connection metrics.
- Keep one smoke test run after each env/config change.
