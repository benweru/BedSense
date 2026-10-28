# Chili messy-photo summary (live)

Not run on these farm photos. The cloud agent had no `MESSY_CHILI_KEY` or `MODEL_API_KEY`, so SAM 3.1 and Muse were not called.

The six fixtures are real bed JPEGs, listed in `fixtures/chili/manifest.json`:

- IMG_8968 — clear green fruit and flowers
- IMG_8965 — the same kind of plant in hard sun and shadow
- IMG_8975 — the bed from far enough that single fruits are not resolved
- IMG_8973 — fruit mostly hidden by leaves and plastic mulch
- IMG_8971 — looking down into the canopy, one ripe fruit among leaves
- IMG_8969 — a gloved hand over the crown

An October 25 pass used Pillow drawings and is not a rate for these files. Run:

```bash
MOCK_META=0 MESSY_CHILI_KEY=... npm run messy-chili
```

`MESSY_CHILI_KEY` is the same key the server joins from `MODEL_API_KEY`, or from `MODEL_API_KEY_0` through `MODEL_API_KEY_5`.
