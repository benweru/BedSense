# Blur gate on the chili photos (offline)

Each farm photo is shrunk to the 1280 px upload size, then blurred. The number is the sharpness score the server computes; below 0.12 the photo is held as unclear when SAM has no strong mark.

| photo | No blur | Slight focus miss (2 px) | Out of focus (5 px) | Badly out of focus (10 px) | Hand shake (16 px sideways) |
| --- | --- | --- | --- | --- | --- |
| high-res | 0.497 | 0.328 | 0.159 | 0.056 (held) | 0.285 |
| hard-light | 0.620 | 0.377 | 0.175 | 0.057 (held) | 0.325 |
| distance | 0.334 | 0.155 | 0.073 (held) | 0.029 (held) | 0.150 |
| hidden | 0.524 | 0.332 | 0.160 | 0.056 (held) | 0.277 |
| canopy | 0.417 | 0.281 | 0.144 | 0.053 (held) | 0.242 |
| occluded | 0.460 | 0.295 | 0.147 | 0.053 (held) | 0.256 |
