# BedSense — Hackathon Submission Notes

Indie track, Build for Your World. Farmers on small vegetable beds photograph a plant and get likely causes, practical mitigation, three next checks, and — only when a spray or fertilizer is the usual next step — example Kenyan agrovet shops with KES price bands. The screen is in English or Kiswahili.

## Built during the event

Everything below was built October 26–November 4, 2026 (the October 25 commits are repo scaffolding: initial commit, demo stub, README). The git history and merged pull requests show the work landing through the building period.

- Photo check pipeline: up to three angles per check, SAM 3.1 masks drawn over the photo, Muse Spark triage in one chat call, dosage guard that drops any numeric spray rate.
- Photo-only checks: the model names the plant from the photo; a wrong name can be corrected on the result for a re-check.
- Follow-up Q&A under every result (`POST /api/ask`): Muse call grounded in the rendered check, with a persisted thread. When a question needs fresh evidence, the model requests one new photo as a tool call and answers from it; every answer passes the same dosage guard.
- Agentic layer: a progress-watcher volunteers worsening and overdue cards from the plant timeline without being asked, and every system decision (watcher verdicts, photo requests, photo answers) is persisted as a visible system turn in the Q&A thread.
- Insufficient-evidence state (`needsInfo`): when the photo does not separate the causes, no chemical is named and the reading asks for the missing angle or fact.
- Swahili repair (`lib/translate.ts`): English drift in model sentences is repaired locally so Kiswahili readings stay Kiswahili.
- Suspect research (`lib/research.ts`): diseases, pests, and deficiencies resolve to catalog chemicals, fertilizers, and cultural practices with example shops.
- Voice notes (`POST /api/transcribe`): tap-to-talk context in English or Kiswahili.
- Share card (`/share`) plus an X share-intent button with prefilled demo text on every result.
- Plant memory: Supabase-backed saved plants, re-check timeline, and practice log, with Row-Level Security per farmer; the app runs signed-out on phone-local history when Supabase is not configured.
- Engineering rigor: GitHub Actions CI running test, lint, and typecheck; zero-env tests proving every route renders usefully with no keys and no Supabase; demo mode (`MOCK_META=1`) and a `/api/diag` deployment probe; 260-test suite, all green.
- One-tap anonymous accounts with email-plus-password as the cross-device path; sign-out is hidden for anonymous users so plants can never be stranded.
- Open-weights fallback: Muse Spark Open answers follow-up Q&A through Baseten when the Model API fails, with a per-answer engine marker and a `/api/open-models` verification probe.
- Creative reference card: a Muse Image "what to look for" illustration for the named suspect, labeled so it can never read as a diagnosis, with prompts constrained to the known suspect list.

## Meta models used

All calls go through `https://api.meta.ai/v1` from the server unless noted; keys never reach the client.

- `sam-3.1` — segmentation masks for the named plant, yellow leaf, and weed (`lib/server/sam.ts`).
- `muse-spark-1.3-contributor`, `muse-spark-1.3` — triage readings and follow-up Q&A, chosen from the live catalog with Muse Wonder accepted as a fallback chat id (`lib/server/meta.ts`).
- `muse-voice-transcribe-1.0` — push-to-talk voice notes (`lib/server/transcribe.ts`).
- `meta-models/muse-spark-open-1026` — open-weights fallback for Q&A through Baseten (`lib/server/open-models.ts`).
- `muse-image-1.0` — reference illustrations through the Responses API (`lib/server/illustrate.ts`).

## Safety rails

- The server strips numeric spray rates, mixing rates, and doses from model output and lowers confidence when it does.
- Chemicals and fertilizers appear only with a verify-with-a-local-agroveterinary-officer note and a product-label-follows rate rule.
- Uncertain readings name no chemical and ask for more evidence instead of guessing.
- Generated reference illustrations are labeled "illustration, not your plant" in every state, and generation prompts can only name suspects from the known research list.
- Demo mode is the default with no key, so a fresh clone runs without calling Meta.
