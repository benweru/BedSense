# Blur lab: plant features on clean and blurred chili photos (live)

Each farm photo is shrunk to the 1280 px upload size and blurred at four levels, then sent to SAM 3.1 and Muse with plant name Chili and no notes. Features Muse named are read from its observations and compared with a hand-made answer key (green pods, red or ripe pods, flowers, yellow leaves) in fixtures/chili/manifest.json.

| blur | SAM found chili | SAM labels same as clean | Muse named real features | Muse named absent features | gate held | gate passed and Muse diagnosed |
| --- | --- | --- | --- | --- | --- | --- |
| No blur | 5/6 (83%) | 6/6 (100%) | 11/13 (85%) | 0 | 1/6 (17%) | 5/6 (83%) |
| Slight focus miss (2 px) | 2/6 (33%) | 3/6 (50%) | 11/13 (85%) | 1 | 1/6 (17%) | 5/6 (83%) |
| Out of focus (5 px) | 0/6 (0%) | 1/6 (17%) | 8/13 (62%) | 1 | 1/6 (17%) | 5/6 (83%) |
| Badly out of focus (10 px) | 0/6 (0%) | 1/6 (17%) | 4/13 (31%) | 2 | 6/6 (100%) | 0/6 (0%) |
| Hand shake (16 px sideways) | 2/6 (33%) | 3/6 (50%) | 9/13 (69%) | 0 | 1/6 (17%) | 5/6 (83%) |

| photo | blur | sharpness | gate | SAM labels | Muse named | confidence | failure |
| --- | --- | --- | --- | --- | --- | --- | --- |
| high-res | clean | 0.497 | use | chili | pods, flowers | 0.85 |  |
| high-res | soft | 0.328 | use | (none) | pods, flowers | 0.4 |  |
| high-res | blurry | 0.159 | use | (none) | pods | 0.35 |  |
| high-res | very-blurry | 0.056 | unclear | (none) | (none) | 0.3 |  |
| high-res | shake | 0.285 | use | (none) | pods, flowers | 0.4 |  |
| hard-light | clean | 0.620 | use | chili, yellow-leaf | pods, yellowLeaf | 0.62 |  |
| hard-light | soft | 0.377 | use | (none) | pods, yellowLeaf | 0.4 |  |
| hard-light | blurry | 0.175 | use | (none) | pods | 0.35 |  |
| hard-light | very-blurry | 0.057 | unclear | (none) | (none) | 0.35 |  |
| hard-light | shake | 0.325 | use | (none) | (none) | 0.4 |  |
| distance | clean | 0.334 | too_far | (none) | (none) | 0.6 |  |
| distance | soft | 0.155 | too_far | (none) | (none) | 0.4 |  |
| distance | blurry | 0.073 | unclear | (none) | (none) | 0.3 |  |
| distance | very-blurry | 0.029 | unclear | (none) | pods, yellowLeaf | 0.3 |  |
| distance | shake | 0.150 | too_far | (none) | (none) | 0.3 |  |
| hidden | clean | 0.524 | use | chili | pods, flowers | 0.85 |  |
| hidden | soft | 0.332 | use | (none) | pods, ripe | 0.6 |  |
| hidden | blurry | 0.160 | use | (none) | pods, ripe | 0.4 |  |
| hidden | very-blurry | 0.056 | unclear | (none) | pods, ripe | 0.35 |  |
| hidden | shake | 0.277 | use | (none) | pods, ripe | 0.5 |  |
| canopy | clean | 0.417 | use | chili, yellow-leaf | pods, ripe, yellowLeaf | 0.6 |  |
| canopy | soft | 0.281 | use | chili, yellow-leaf | pods, ripe, yellowLeaf | 0.6 |  |
| canopy | blurry | 0.144 | use | yellow-leaf | pods, ripe, yellowLeaf | 0.45 |  |
| canopy | very-blurry | 0.053 | unclear | (none) | pods, ripe | 0.3 |  |
| canopy | shake | 0.242 | use | chili, yellow-leaf | pods, ripe, yellowLeaf | 0.55 |  |
| occluded | clean | 0.460 | use | chili | pods, flowers | 0.6 |  |
| occluded | soft | 0.295 | use | chili | pods, flowers, yellowLeaf | 0.6 |  |
| occluded | blurry | 0.147 | use | (none) | pods, yellowLeaf | 0.4 |  |
| occluded | very-blurry | 0.053 | unclear | (none) | (none) | 0.3 |  |
| occluded | shake | 0.256 | use | chili | pods, flowers | 0.55 |  |
