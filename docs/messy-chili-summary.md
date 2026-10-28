# Chili messy-photo summary (simulated)

These percentages are scripted SAM and Muse replies used to test the logger. They are not measurements of the farm photos in fixtures/chili. Those files are real bed JPEGs: IMG_8968, IMG_8965, IMG_8975, IMG_8973, IMG_8971, and IMG_8969. A live grade needs MOCK_META=0 and MESSY_CHILI_KEY set to the same key as MODEL_API_KEY, then npm run messy-chili.

Photos: 6

- SAM named the chili crop: 2/6 (33%)
- SAM returned any mark: 3/6 (50%)
- Muse returned a real diagnosis (causes, not the local backup): 4/6 (67%)
- Muse failed: 2/6 (33%)
- No chili crop and no Muse diagnosis: 2/6 (33%)

| id | quality | SAM | marks | Muse | failure | model |
| --- | --- | --- | --- | --- | --- | --- |
| high-res | Clear fruit and flowers (IMG_8968) | crop | 6 | diagnosis |  | muse-spark-1.3-contributor |
| distance | Distant bed (IMG_8975) | none | 0 | diagnosis |  | muse-spark-1.3-contributor |
| hidden | Fruit mostly hidden (IMG_8973) | none | 0 | fail | local-fallback |  |
| hard-light | Hard sun and shadow (IMG_8965) | crop | 6 | diagnosis |  | muse-spark-1.3-contributor |
| canopy | Looking down into the canopy (IMG_8971) | marks only | 2 | diagnosis |  | muse-spark-1.3-contributor |
| occluded | Glove over the crown (IMG_8969) | none | 0 | fail | muse_unavailable |  |
