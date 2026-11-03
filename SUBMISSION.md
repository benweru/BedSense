# BedSense — Hackathon Submission Notes

Indie track, Build for Your World. Farmers on small vegetable beds photograph a plant and get likely causes, practical mitigation, three next checks, and — only when a spray or fertilizer is the usual next step — example Kenyan agrovet shops with KES price bands. The screen is in English or Kiswahili.

## Built during the event

Everything below was built October 26–November 4, 2026 (the October 25 commits are repo scaffolding: initial commit, demo stub, README). The git history and merged pull requests show the work landing through the building period.

- Photo check pipeline: up to three angles per check, SAM 3.1 masks drawn over the photo, Muse Spark triage in one chat call, dosage guard that drops any numeric spray rate.
- Photo-only checks: the model names the plant from the photo; a wrong name can be corrected on the result for a re-check.
- Follow-up Q&A under every result (`POST /api/ask`): text-only Muse call grounded in the rendered check, with a persisted thread.
- Insufficient-evidence state (`needsInfo`): when the photo does not separate the causes, no chemical is named and the reading asks for the missing angle or fact.
- Swahili repair (`lib/translate.ts`): English drift in model sentences is repaired locally so Kiswahili readings stay Kiswahili.
- Suspect research (`lib/research.ts`): diseases, pests, and deficiencies resolve to catalog chemicals, fertilizers, and cultural practices with example shops.
- Voice notes (`POST /api/transcribe`): tap-to-talk context in English or Kiswahili.
- Plant memory: Supabase-backed saved plants, re-check timeline, and practice log, with Row-Level Security per farmer; the app runs signed-out on phone-local history when Supabase is not configured.
- Demo mode (`MOCK_META=1`) and `/api/diag` deployment probe; 185-test suite with lint and typecheck gates.

## Meta models used

All calls go through `https://api.meta.ai/v1` from the server; the key never reaches the client.

- `sam-3.1` — segmentation masks for the named plant, yellow leaf, and weed (`lib/server/sam.ts`).
- `muse-spark-1.3-contributor`, `muse-spark-1.3` — triage readings and follow-up Q&A, chosen from the live catalog with Muse Wonder accepted as a fallback chat id (`lib/server/meta.ts`).
- `muse-voice-transcribe-1.0` — push-to-talk voice notes (`lib/server/transcribe.ts`).

## Safety rails

- The server strips numeric spray rates, mixing rates, and doses from model output and lowers confidence when it does.
- Chemicals and fertilizers appear only with a verify-with-a-local-agroveterinary-officer note and a product-label-follows rate rule.
- Uncertain readings name no chemical and ask for more evidence instead of guessing.
- Demo mode is the default with no key, so a fresh clone runs without calling Meta.
