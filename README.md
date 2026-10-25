# BedSense

BedSense is a phone-first check for any vegetable farm bed. Photograph one bed. The app marks what is growing. Onion is the primary crop it is built around. Beetroot and chili are secondary crops, each grown on its own bed. Onion and beetroot are never on the same bed. Chili is a separate bed as well.

## Who it is for

Farmers on small vegetable beds, and the extension officers who walk those beds with them, when someone needs a second look before the bed is treated.

BedSense is an indie entry for the **Meta Global AI Developer Hackathon**, **Indie** track, **Build for Your World**.

## What a photo becomes

[SAM 3.1](https://dev.meta.ai/docs/sam/segmenting) marks onion, beetroot, and chili, plus yellow leaves and weeds. A photo is one bed. Those three crops are grown on different beds, so more than one of them in a frame is unusual, not the planting pattern. [Muse Spark](https://dev.meta.ai/docs/models) reads the photo and those marks and returns exactly three next checks. A next check is a practical, non-chemical thing to look at or do next on the bed — a triage step. The screen is in English or Kiswahili.

## Three checks, not a diagnosis

Muse returns exactly three next checks. They are three practical, non-chemical things to look at or do next on the bed. They are triage steps. They are not a diagnosis, and they are not a treatment rate or a spray dose. BedSense does not name a disease as a fact. Every result asks you to show the photo to an agronomist or extension officer before you treat the bed.

## License

MIT. See [LICENSE](LICENSE).

## Running it yourself

Setup for contributors is in [docs/development.md](docs/development.md).
