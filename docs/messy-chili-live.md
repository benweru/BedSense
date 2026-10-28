# Chili messy-photo summary (live production)

Graded on 28 Oct 2026, about 12:25–12:27 Africa/Nairobi, against https://bedsense.vercel.app/api/analyze. Plant name Chili, empty context. Models: SAM 3.1 and Muse Spark 1.3 (`muse-spark-1.3-contributor`). These are live production numbers, not the scripted 2/6 logger check in `docs/messy-chili-summary.md`.

Photos: 6

- SAM named the chili crop: 5/6 (83%). The miss is the distant bed, IMG_8975.
- SAM returned any mark: 5/6 (83%)
- Muse returned a real diagnosis (causes): 6/6 (100%)
- Muse failed: 0/6 (0%)

| id | file | quality | samChili | samMarks | concepts | museDiagnosis | causesN |
| --- | --- | --- | --- | --- | --- | --- | --- |
| high-res | IMG_8968.jpg | Clear fruit and flowers | yes | 1 | chili | yes | 2 |
| hard-light | IMG_8965.jpg | Hard sun and shadow | yes | 3 | chili, yellow-leaf | yes | 3 |
| distance | IMG_8975.jpg | Distant bed | no | 0 | (none) | yes | 2 |
| hidden | IMG_8973.jpg | Fruit mostly hidden | yes | 1 | chili | yes | 2 |
| canopy | IMG_8971.jpg | Looking down into the canopy | yes | 5 | chili, yellow-leaf | yes | 3 |
| occluded | IMG_8969.jpg | Glove over the crown | yes | 1 | chili | yes | 2 |

The distant frame still received two causes even though SAM marked nothing. That is the case the quality gate is meant to hold back: a wide shot with no strong mark should ask the farmer to move closer instead of inventing a diagnosis.

IMG_8965 is hard sun and still returned three chili and yellow-leaf marks plus a Muse diagnosis. That lighting is not extreme on the contrast score, and a strong mark keeps a hard-sun photo in the check. Only a crushed, deeply shadowed, or blown-out frame is held, and only when SAM did not lock the plant.
