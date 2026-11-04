# BedSense

[![CI](https://github.com/benweru/BedSense/actions/workflows/ci.yml/badge.svg)](https://github.com/benweru/BedSense/actions/workflows/ci.yml)

Your plants can't talk, but your phone can listen — photograph any plant and get quick, practical advice.

**Live demo:** [https://bedsense.vercel.app](https://bedsense.vercel.app)

BedSense is an indie entry for the **Meta Global AI Developer Hackathon**, **Indie** track, **Build for Your World**. It is built for farmers on small vegetable beds — and the extension officers who walk those beds with them. The screen is in English or Kiswahili.

Just photograph the plant — BedSense names it from the photo. If it names the wrong plant, correct it on the result and re-check. You can add one optional note: plant age or stage, current practices, chemicals already used, recent fertilizer, irrigation or weather, known issues, or anything else.

## What a photo becomes

The photo is read with SAM 3.1 segmentation plus Muse Spark triage in one chat call. When a symptom is visible, you get likely causes, practical mitigation, and three next checks for that plant. Example Kenyan agrovet shops and KES price bands appear when a spray is the usual next step, or when a fertilizer fits the symptom. When the photo does not separate the likely causes, no chemical is named: you get the safe steps that can start now and a plain statement of the angle or fact still needed. Every check ends with follow-up Q&A under the three next checks, where you can ask about the feedback without running a new check — and if your question needs fresh evidence, the model asks for one new photo and answers from it. A progress-watcher volunteers worsening and overdue cards from the plant timeline, and every system decision is traced as a visible entry in the thread. Spray rates follow the product label. Confirm with a local agroveterinary officer before you buy or spray.

## Saved plants remember

Sign in and save a plant, and later checks are read against its history: earlier findings, what you sprayed or fed, and whether things improved. Each check also sets when to look again — the model judges how soon improvement or worsening would show, so a treated plant is re-checked after the spray has had time to work, and a healthy one only weekly. Without an account, the app keeps the last checks on the phone as before.

## Getting started

You need **Node.js 20.17 or newer** (22 recommended), **npm** (ships with Node), and **git**. No API keys are required to run the demo: with an empty env file the app runs in mock mode and never calls Meta.

### 1. Install prerequisites

**macOS**

```bash
# Homebrew (https://brew.sh), or download the LTS installer from https://nodejs.org
brew install node git
node --version   # v20.17.0 or newer
```

Prefer a version manager? `brew install nvm`, then `nvm install 22`.

**Windows**

1. Install the Node.js **LTS** from [https://nodejs.org](https://nodejs.org) (or `winget install OpenJS.NodeJS.LTS`), and [Git for Windows](https://git-scm.com/downloads/win) (gives you Git Bash).
2. Open **Git Bash** or PowerShell and verify:

```bash
node --version   # v20.17.0 or newer
git --version
```

Prefer a version manager? Use [nvm-windows](https://github.com/coreybutler/nvm-windows), then `nvm install 22`.

> The commands below use `cp`. In PowerShell use `copy .env.example .env.local` instead; in Git Bash `cp` works as written.

**Linux (Ubuntu / Debian)**

```bash
# Node 22 via NodeSource, or use nvm (https://github.com/nvm-sh/nvm)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git
node --version   # v20.17.0 or newer
```

Fedora: `sudo dnf install -y nodejs git` (then check the version is ≥ 20.17; use nvm if the distro ships older).

### 2. Clone and install

```bash
git clone https://github.com/benweru/BedSense.git
cd BedSense
npm install
```

If `npm install` fails writing to its cache (permission error on a shared machine), rerun with a local cache:

```bash
npm install --cache /tmp/npm-cache
```

### 3. Configure the environment

```bash
cp .env.example .env.local
```

`.env.local` is yours and is never committed. With the defaults (`MOCK_META=1`, empty keys) the app runs the full demo with synthetic data.

| Variable | Purpose |
| --- | --- |
| `MODEL_API_KEY` | Meta Model API key (`https://api.meta.ai/v1`). Server-only. Used as-is when ≥ 40 characters. Leave empty for the demo. |
| `MODEL_API_KEY_0` … `MODEL_API_KEY_5` | Optional Vercel workaround: the server joins these when the single key is missing or short. Leave empty locally. |
| `MOCK_META` | `1` = demo with no model calls. `0` = live SAM + Muse calls. Unset + no key also stays in demo. |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Supabase project for accounts and saved plants. Server-only. Leave empty to run signed-out on phone history. |
| `NEXT_PUBLIC_SITE_URL` | Canonical public URL printed on shares. Leave empty to use the production link. |
| `OPEN_MODELS_BASE_URL` / `OPEN_MODELS_API_KEY` / `OPEN_MODELS_MODEL` | Muse Spark Open fallback via Baseten. Leave the key empty to disable; the app never requires it. |

Live mode:

```bash
MODEL_API_KEY=your_key_here
MOCK_META=0
```

### 4. Run it

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — on your phone or in a narrow browser window. Take a photo or choose one from the library. To test from a real phone on the same Wi-Fi, start with `npx next dev -H 0.0.0.0` and open `http://<your-computer-ip>:3000` on the phone (allow Node through the firewall if the OS asks).

### 5. Accounts (optional, Supabase)

Skip this to run signed-out. To enable sign-in and saved plants:

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the project's **SQL Editor**, paste the whole `supabase/migrations/20261029000000_plant_memory.sql` file, and run it. This creates the tables, the `plant-photos` storage bucket, and the per-farmer access rules.
3. Copy the project's URL and `anon` key into `.env.local` as `SUPABASE_URL` and `SUPABASE_ANON_KEY`, then restart `npm run dev`.
4. Authentication → URL Configuration: set **Site URL** to your origin (`http://localhost:3000` locally, the Vercel URL in production) and add `<origin>/api/auth/callback` to **Redirect URLs**, or email sign-in links land on a page that never completes.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server on port 3000 |
| `npm test` | Run the suite (274 tests across 39 files) |
| `npm run lint` | ESLint with zero warnings allowed |
| `npm run build` / `npm start` | Production build / serve it (needs network for fonts) |
| `npm run messy-chili` | Grade six real chili-bed photos through the photo gates |
| `npx tsc --noEmit` | Typecheck |

CI runs test, lint, and typecheck on every push and pull request.

## Project layout

```text
app/                  Routes: / (check), /plants, /profile, /share, /api/*
components/           UI: result cards, chat thread, plant memory, reference card
lib/                  Shared logic: research KB, translate repair, watcher, decisions
lib/server/           Server-only: Meta calls, mock mode, Supabase, open models
supabase/migrations/  Database schema + storage + access rules
tests/                Vitest suite, including zero-env route coverage
docs/                 Contributor docs and the build log
```

Key endpoints: `POST /api/analyze` (photo check), `POST /api/ask` (grounded follow-up Q&A with photo tool loop), `POST /api/illustrate` (Muse Image reference card), `POST /api/transcribe` (voice notes), `GET /api/diag` and `GET /api/open-models` (deployment probes), `/api/plants` and `/api/auth` (memory + accounts).

## Models used

All calls go through `https://api.meta.ai/v1` (or the partner endpoint for open weights) from the server; keys never reach the client.

- `sam-3.1` — segmentation masks over the photo
- `muse-spark-1.3-contributor`, `muse-spark-1.3` — triage readings and Q&A (Muse Wonder accepted as a chat fallback)
- `muse-voice-transcribe-1.0` — push-to-talk notes
- `meta-models/muse-spark-open-1026` — open-weights Q&A fallback via Baseten
- `muse-image-1.0` — "what to look for" reference illustrations

## Deploying

Push to `main` on GitHub; the linked Vercel project builds and deploys it. Set the same env vars in the Vercel dashboard (Production environment): `MODEL_API_KEY` (or the `_0`–`_5` parts if Vercel truncates it), `MOCK_META=0`, `SUPABASE_URL` / `SUPABASE_ANON_KEY`, `OPEN_MODELS_API_KEY` if you have Baseten credits, and `NEXT_PUBLIC_SITE_URL` for share links. Then verify `/api/diag` and `/api/open-models` on the live URL.

## Troubleshooting

**Port 3000 is busy.** Another dev server is running. Stop it (Ctrl+C in its terminal), or start on another port: `npx next dev -p 3001`. To find the holder: macOS/Linux `lsof -ti:3000 | xargs kill`; Windows PowerShell `Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process`.

**`next dev` 404s on /profile or /plants while / works.** Your server predates those routes (or a branch switch confused it). Stop it, confirm `git branch --show-current`, restart, and hard-refresh (Cmd/Ctrl+Shift+R).

**`npm install` permission errors.** Rerun with `npm install --cache /tmp/npm-cache` (Linux/macOS) or `%TEMP%\npm-cache` (Windows).

**Build fails fetching Google Fonts.** The build downloads fonts at build time, so it needs network access. `npx tsc --noEmit` verifies types without that step.

**Sign-in codes never arrive (SMS).** Supabase sends SMS only when you configure a paid SMS provider in its dashboard. Email sign-in works with no extra setup once Site URL and Redirect URLs are set (see step 5 above).

**Something else?** The contributor guide is [docs/development.md](docs/development.md), and `SUBMISSION.md` lists everything built during the hackathon with the model inventory and safety rails.

## License

MIT. See [LICENSE](LICENSE).
