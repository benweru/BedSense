# Chili messy-photo summary (live production)

Graded on 2026-10-25 against https://bedsense.vercel.app/api/analyze (deployed main, plant name Chili, empty context). Each fixture is a generated drawing of a curled chili at a controlled quality, not a field photo.

One high-res request a minute before this table returned HTTP 200 in 11.3s: `muse-spark-1.3-contributor`, 0 SAM marks, 3 likely causes, no backup note. The six requests below then all returned `muse_unavailable` in about one second. Muse access on this key is intermittent. A `muse_unavailable` body is sent before masks are included, so those rows do not measure SAM. The only SAM observation is the successful high-res call: no crop mark on this drawing, and Muse still returned causes.

Photos: 6

- SAM named the chili crop: 0/6 (0%)
- SAM returned any mark: 0/6 (0%)
- Muse returned a real diagnosis (causes, not the local backup): 0/6 (0%)
- Muse failed: 6/6 (100%)
- No chili crop and no Muse diagnosis: 6/6 (100%)

| id | quality | HTTP | ms | SAM | marks | Muse | failure | model |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| high-res | High resolution | 503 | 1724 | none | 0 | fail | muse_unavailable |  |
| blurred | Blurred | 503 | 860 | none | 0 | fail | muse_unavailable |  |
| low-res | Low resolution | 503 | 1002 | none | 0 | fail | muse_unavailable |  |
| bad-lighting | Bad lighting | 503 | 1025 | none | 0 | fail | muse_unavailable |  |
| odd-angle | Odd angle | 503 | 1451 | none | 0 | fail | muse_unavailable |  |
| occluded | Occluded | 503 | 1455 | none | 0 | fail | muse_unavailable |  |
