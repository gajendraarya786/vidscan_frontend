# VidScan Frontend

Next.js 14 (App Router · TypeScript · Tailwind CSS) frontend for **VidScan** — a free browser-based tool that converts videos of book pages and documents into clean PDFs.

---

## Quick Start (Local Dev)

### Prerequisites
- **Node.js ≥ 18**
- The FastAPI backend running (see `../vidscan_backend/README.md`)

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local — set NEXT_PUBLIC_API_URL=http://localhost:8000

# 3. Start dev server
npm run dev
# → http://localhost:3000
```

---

## Environment Variables

| Variable | Required | Example | Description |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | ✅ | `http://localhost:8000` | FastAPI backend URL |
| `NEXT_PUBLIC_SITE_URL` | ✅ | `https://vidscan.app` | Frontend canonical URL (sitemap, OG) |
| `NEXT_PUBLIC_ADSENSE_ID` | ❌ | `ca-pub-XXXXXXXX` | AdSense publisher ID — leave blank to disable ads |
| `NEXT_PUBLIC_AD_SLOT_TOP` | ❌ | `1234567890` | Ad slot above the converter |
| `NEXT_PUBLIC_AD_SLOT_BOTTOM` | ❌ | `0987654321` | Ad slot below download button |

---

## Project Structure

```
app/
├── layout.tsx                    # Root layout — metadata, JSON-LD schema, AdSense
├── page.tsx                      # Landing page with FAQ and feature cards
├── convert/page.tsx              # Main conversion tool
├── convert-book-video-to-pdf/    # Long-tail SEO page
├── scan-document-to-pdf/         # Long-tail SEO page
├── video-notes-to-pdf/           # Long-tail SEO page
├── sitemap.ts                    # Dynamic sitemap (/sitemap.xml)
└── robots.ts                     # Dynamic robots.txt (/robots.txt)
components/
├── AdUnit.tsx                    # Reusable Google AdSense ins tag
└── ProgressBar.tsx               # Animated conversion progress bar
public/
└── robots.txt                    # Static fallback robots.txt
```

---

## Deploy to Vercel (Recommended)

### Step 1 — Deploy the backend to Railway

1. Push `vidscan_backend` to GitHub.
2. Create a new project at [railway.app](https://railway.app) from the repo.
3. Set env vars in Railway and deploy.
4. Note the public URL: `https://your-backend.up.railway.app`

### Step 2 — Update `vercel.json`

Edit the rewrite destination in [`vercel.json`](./vercel.json):

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://your-backend.up.railway.app/:path*"
    }
  ]
}
```

### Step 3 — Import to Vercel

1. Push this repo to GitHub.
2. [vercel.com/new](https://vercel.com/new) → Import repo → Next.js auto-detected.

### Step 4 — Set environment variables

In Vercel **Settings → Environment Variables**:

```
NEXT_PUBLIC_API_URL     = https://your-backend.up.railway.app
NEXT_PUBLIC_SITE_URL    = https://your-vercel-domain.vercel.app
NEXT_PUBLIC_ADSENSE_ID  = ca-pub-XXXXXXXXXXXXXXXX   (optional)
NEXT_PUBLIC_AD_SLOT_TOP = 1234567890                (optional)
NEXT_PUBLIC_AD_SLOT_BOTTOM = 0987654321             (optional)
```

### Step 5 — Deploy

Click **Deploy**. Future pushes to `main` auto-deploy.

---

## Deploy with Docker (Self-hosted)

```bash
# Build image (uses standalone output from next.config.mjs)
docker build -t vidscan-frontend .

# Run
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=https://your-backend.up.railway.app \
  -e NEXT_PUBLIC_SITE_URL=https://your-domain.com \
  vidscan-frontend
```

> A `Dockerfile` is not included by default. See the
> [Next.js Docker example](https://github.com/vercel/next.js/tree/canary/examples/with-docker).

---

## API Proxy

Both `next.config.mjs` (self-hosted) and `vercel.json` (Vercel CDN edge) proxy
`/api/*` → `NEXT_PUBLIC_API_URL/*`.

The convert page calls the backend directly via `NEXT_PUBLIC_API_URL`.
To switch to the relative proxy path instead, change:

```ts
// In app/convert/page.tsx
const API_URL = "/api"; // uses the /api/* rewrite
```

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Dev server on port 3000 |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | Run ESLint |

---

## SEO Pages

| URL | Target Keyword |
|---|---|
| `/` | "video to pdf converter free online" |
| `/convert` | Main tool |
| `/convert-book-video-to-pdf` | "convert book video to pdf" |
| `/scan-document-to-pdf` | "scan document to pdf" |
| `/video-notes-to-pdf` | "video notes to pdf" |
| `/sitemap.xml` | Auto-generated |
| `/robots.txt` | Auto-generated |
