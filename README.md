# LensAI — Image Caption Generator

> Upload any image → AI generates a caption + hashtags in seconds.

**Live Demo:** https://lensai-image-caption-generator.vercel.app

**Live API (Backend):** https://lensai-image-caption-generator.onrender.com/api/health

<p align="center">
   <img src="https://i.postimg.cc/LXks5Dft/Screenshot-2026-04-06-013120.png" alt="Portfolio Preview" width="100%" />
</p>
<p align="center">
   <em>Landing page preview of my portfolio website.</em>
</p>

## Tech Stack

| Layer         | Tech                                                          |
| ------------- | ------------------------------------------------------------- |
| Frontend      | React 18 + Vite + Tailwind CSS                                |
| Backend       | Node.js + Express                                             |
| Database      | MongoDB Atlas                                                 |
| Image Storage | Cloudinary                                                    |
| AI Model      | HuggingFace Inference Providers (`Qwen/Qwen3-VL-8B-Instruct`) |
| Auth          | JWT + bcrypt                                                  |
| Deployment    | Vercel (frontend) + Render (backend)                          |

## Features

- Drag & drop image upload (JPG, PNG, WEBP, max 5MB)
- AI-generated captions using multimodal vision-language inference
- Multi-variant caption generation (2 to 3 options per image)
- Platform presets: Instagram, LinkedIn, X, YouTube, General
- Brand voice profiles: Default, Minimal, Playful, Luxury, Bold, Friendly
- Rewrite tools: Shorten, Add Emojis, Make Formal, Make Funny, CTA Boost
- Auto-generated alt text for accessibility
- Auto-generated hashtags from caption
- Batch mode (up to 3 images at once)
- 5 caption tones: Neutral, Poetic, Funny, Professional, Instagram
- One-click copy (caption + hashtags)
- User auth (register/login with JWT)
- Smart caption history: search, tone/platform filters, favorites
- Delete saved captions

## No Dataset Required

This project uses provider-based inference via HuggingFace.
No training needed — just an API token and active provider routing.

---

## Local Setup

### Prerequisites

- Node.js v18+
- MongoDB Atlas account (free)
- Cloudinary account (free)
- HuggingFace account + API token (free)

### Step 1 — Clone and install

```bash
git clone https://github.com/Shreya-Shukla27/lensai-image-caption-generator.git
cd lensai-image-caption-generator

# Install server deps
cd server && npm install

# Install client deps
cd ../client && npm install
```

### Step 2 — Configure environment variables

For macOS/Linux:

```bash
cd server
cp .env.example .env
```

For Windows PowerShell:

```powershell
cd server
Copy-Item .env.example .env
```

Now fill in your values in `.env`.

Or use interactive setup:

```bash
cd server
npm run setup-env
```

For the client (production deploys), create client env file:

For macOS/Linux:

```bash
cd ../client
cp .env.example .env
```

For Windows PowerShell:

```powershell
cd ../client
Copy-Item .env.example .env
```

Set `VITE_API_URL` to your backend URL (example: `https://lensai-api.onrender.com`).

Your `.env` should look like:

```
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/lensai
CLOUD_NAME=your_cloudinary_cloud_name
CLOUD_API_KEY=your_cloudinary_key
CLOUD_API_SECRET=your_cloudinary_secret
HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxx
HF_VISION_MODEL=Qwen/Qwen3-VL-8B-Instruct
HF_PROVIDERS=together,novita
JWT_SECRET=make_this_a_long_random_string
PORT=5000
```

**Where to get each value:**

- `MONGO_URI`: MongoDB Atlas → Create cluster → Connect → Drivers → copy URI
- `CLOUD_NAME/KEY/SECRET`: Cloudinary Dashboard → Settings → Access Keys
- `HF_TOKEN`: huggingface.co → Settings → Access Tokens → New token (read)
- `HF_VISION_MODEL` and `HF_PROVIDERS`: optional overrides for provider-based caption inference (defaults are already set)
- `JWT_SECRET`: Any long random string — e.g. run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `CLIENT_URLS`: comma-separated frontend URLs allowed by CORS

### Step 3 — Run locally

Open two terminals:

**Terminal 1 — Backend:**

```bash
cd server
npm run check-env
npm run dev
# Runs on http://localhost:5000
```

Optional quick API verification (run in a new terminal after backend starts):

```bash
cd server
npm run smoke-api
```

Optional full end-to-end smoke test (register -> caption -> history -> delete):

```bash
cd server
npm run smoke-full
```

Optional service credentials verification (run after filling env values):

```bash
cd server
npm run verify-services
```

**Terminal 2 — Frontend:**

```bash
cd client
npm run dev
# Runs on http://localhost:5173
```

Open http://localhost:5173 in your browser.

---

## Deployment

### Deploy Backend to Render

1. Push your code to GitHub
2. Go to render.com → New → Web Service
3. Connect your GitHub repo
4. Set:
   - Build command: `cd server && npm install`
   - Start command: `cd server && npm run start`
5. Add environment variables in Render:
   - `MONGO_URI`
   - `CLOUD_NAME`
   - `CLOUD_API_KEY`
   - `CLOUD_API_SECRET`
   - `HF_TOKEN`
   - `HF_VISION_MODEL` (optional, default: `Qwen/Qwen3-VL-8B-Instruct`)
   - `HF_PROVIDERS` (optional, default: `together,novita`)
   - `JWT_SECRET`
   - `CLIENT_URLS` (include your deployed frontend URL)
   - `PORT` (optional; Render sets this automatically)
6. Deploy — note your Render URL (e.g. `https://lensai-api.onrender.com`)

After deploy, run a quick backend smoke check from your machine:

```bash
cd server
API_BASE_URL=https://your-backend.onrender.com npm run smoke-api
```

Windows PowerShell equivalent:

```powershell
cd server
$env:API_BASE_URL="https://your-backend.onrender.com"
npm run smoke-api
```

### Deploy Frontend to Vercel

1. Go to vercel.com → New Project → Import your GitHub repo
2. Set:
   - Framework: Vite
   - Build command: `cd client && npm install && npm run build`
   - Output directory: `client/dist`
3. Add environment variable:
   - `VITE_API_URL` = your Render backend URL (with or without `/api`)
4. Deploy

Set backend `CLIENT_URLS` in Render to include your deployed frontend URL(s).
You can use wildcards for preview domains (example: `https://*.vercel.app`, `https://*.netlify.app`).
If you override model/provider settings in Render, add `HF_VISION_MODEL` and `HF_PROVIDERS` there as well.

### Deploy Frontend to Netlify

1. Connect your GitHub repo to Netlify
2. Netlify reads `netlify.toml` automatically
3. Add env variable:
   - `VITE_API_URL` = your Render backend URL
4. Deploy

---

## Project Structure

```
lensai/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   ├── UploadZone.jsx
│   │   │   ├── ToneSelector.jsx
│   │   │   └── CaptionResult.jsx
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   └── History.jsx
│   │   ├── hooks/
│   │   │   └── useAuth.jsx
│   │   └── utils/
│   │       └── api.js
│   └── package.json
├── server/
│   ├── config/
│   │   ├── cloudinary.js
│   │   └── db.js
│   ├── middleware/
│   │   └── auth.js
│   ├── models/
│   │   ├── User.js
│   │   └── Caption.js
│   ├── routes/
│   │   ├── auth.js
│   │   └── caption.js
│   ├── index.js
│   └── .env.example
└── README.md
```

---

## API Endpoints

| Method | Route                       | Auth     | Description                                                                                                                      |
| ------ | --------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/auth/register`        | No       | Create account                                                                                                                   |
| POST   | `/api/auth/login`           | No       | Login, get JWT                                                                                                                   |
| POST   | `/api/caption`              | Optional | Upload one image, get 2 to 3 caption options + alt text                                                                          |
| POST   | `/api/caption/batch`        | Optional | Upload up to 3 images and generate captions in one call                                                                          |
| POST   | `/api/caption/rewrite`      | Optional | Rewrite a caption using shortcut actions                                                                                         |
| GET    | `/api/caption/history`      | Required | Get filtered caption history (`q`, `tone`, `platform`, `favorite`, `sort`, `from`, `to`, `limit`, `pagination=cursor`, `cursor`) |
| PATCH  | `/api/caption/:id/favorite` | Required | Toggle or set favorite on a saved caption                                                                                        |
| DELETE | `/api/caption/:id`          | Required | Delete a saved caption                                                                                                           |
| GET    | `/api/health`               | No       | Server health check                                                                                                              |


## Public Repo Safety

- This repository is public for portfolio and learning use.
- Never commit real secrets.
- Keep local development keys only in `server/.env` on your machine.
- Keep production keys in hosting environment variables (Render/Vercel), not in tracked files.
- Keep `server/.env.example` as placeholders only.
- Keep backend-only logic on the server side; frontend bundles are always visible in the browser.
- If a key is exposed, rotate it immediately in the provider dashboard.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).

## Release Checklist

See [GO_LIVE_CHECKLIST.md](GO_LIVE_CHECKLIST.md) for final production rollout and validation steps.
