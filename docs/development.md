# Development

How to run and change BedSense on your own machine. The public product page is the [README](../README.md).

Node.js 20.17 or newer.

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) on your phone, or in a narrow browser window. Take a photo or choose one from the library. The app resizes it on the device, then `POST`s it to `/api/analyze`.

`.env.example` sets `MOCK_META=1` and leaves `MODEL_API_KEY` empty. That path returns synthetic masks and advice and does not call Meta. Use it for the demo, for judges without a key, and for `npm test`. If neither variable is set, BedSense stays in demo mode so a fresh clone still runs. Live calls happen only when `MOCK_META=0` and `MODEL_API_KEY` is set.

## Environment

| Variable | Purpose |
| --- | --- |
| `MODEL_API_KEY` | Bearer token for `https://api.meta.ai/v1`. Read only on the server. Leave empty in mock mode. |
| `MOCK_META` | `1` runs the demo with no model calls. `0` calls SAM 3.1, then Muse Spark. |

Copy `.env.example` to `.env.local`. Never commit a real key. `.gitignore` ignores `.env*`.

Live mode:

```bash
MODEL_API_KEY=your_key_here
MOCK_META=0
```

Muse Spark is called as `muse-spark-1.3-contributor` first (contributor mode, lower price; prompts may be used to train future Meta models). If that call fails, BedSense retries `muse-spark-1.3` (standard mode). If both fail, the masks still return with a local backup of three non-chemical checks, and the screen says so.

## Pipeline

```mermaid
flowchart LR
  phone[Phone photo or camera] --> resize[Resize on device]
  resize --> api["POST /api/analyze"]
  api --> sam["SAM 3.1 · POST /v1/responses"]
  sam --> marks[Masks, boxes, counts]
  marks --> muse["Muse Spark · POST /v1/chat/completions"]
  muse --> guard[Dosage guard and fixed disclaimer]
  guard --> ui[Marks, observations, 3 actions, confidence]
```

1. The browser keeps the last five checks in `localStorage` and can switch the chrome between English and Kiswahili. Model text follows the language selected when you take the photo.
2. `/api/analyze` accepts a JPEG, PNG, or WebP data URL. The key never goes to the client.
3. The segmentation model id is `sam-3.1`. It runs five concept prompts, one noun phrase each: `onion plant`, `beetroot plant`, `chili pepper plant`, `yellow leaf`, `weed`. Requests use `metadata.mask_encoding=one_bit` and `metadata.include_confidence=true`. Masks are decoded with `@meta-sam/parser` and sent to the phone as a small grid drawn over the photo.
4. Onion area is weighted slightly higher when the bed is a near-tie, so the primary crop stays onion-first. A bed that is clearly beetroot or chili is labeled that way, and the copy still says onion is what BedSense is built around.
5. Muse Spark sees the photo plus the counts and must return JSON: observations, exactly three actions, and a confidence score. A server-side guard drops any spray rate (millilitres, grams, litres per tank or hectare, including common Swahili units) and replaces it with a safe check. The disclaimer and the ask-an-agronomist callout are fixed copy, not model prose.

## Scripts

```bash
npm test
npm run lint
npm run build
```

`npm start` serves a production build.
