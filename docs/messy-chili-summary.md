# Chili messy-photo summary (simulated)

These rates come from the harness with scripted SAM and Muse replies, one per fixture. They are not a live Meta run. Grade the same files against SAM 3.1 and Muse with `MOCK_META=0 MESSY_CHILI_KEY=... npm run messy-chili`.

Photos: 6

- SAM named the chili crop: 2/6 (33%)
- SAM returned any mark: 3/6 (50%)
- Muse returned a real diagnosis (causes, not the local backup): 4/6 (67%)
- Muse failed: 2/6 (33%)
- No chili crop and no Muse diagnosis: 2/6 (33%)

| id | quality | SAM | marks | Muse | failure | model |
| --- | --- | --- | --- | --- | --- | --- |
| high-res | High resolution | crop | 6 | diagnosis |  | muse-spark-1.3-contributor |
| blurred | Blurred | none | 0 | diagnosis |  | muse-spark-1.3-contributor |
| low-res | Low resolution | none | 0 | fail | local-fallback |  |
| bad-lighting | Bad lighting | crop | 6 | diagnosis |  | muse-spark-1.3-contributor |
| odd-angle | Odd angle | marks only | 2 | diagnosis |  | muse-spark-1.3-contributor |
| occluded | Occluded | none | 0 | fail | muse_unavailable |  |
