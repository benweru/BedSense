# BedSense

BedSense is a phone-first check for a vegetable bed in Kenya. Photograph the bed. The app marks what is growing and suggests three things to look at next. Onion is the crop it is built around. Beetroot and chili can share the same bed.

## Who it is for

Farmers on small vegetable beds, and the extension officers who walk those beds with them, when someone needs a second look before the bed is treated.

BedSense is an indie entry for the **Meta Global AI Developer Hackathon**, **Indie** track, **Build for Your World**.

## What a photo becomes

[SAM 3.1](https://dev.meta.ai/docs/sam/segmenting) marks onion, beetroot, and chili, plus yellow leaves and weeds. [Muse Spark](https://dev.meta.ai/docs/models) reads the photo and those marks and returns three checks. The screen is in English or Kiswahili.

## A check, not a diagnosis

The result is triage. BedSense does not name a disease as a fact, and it never gives a spray dose. Every result asks you to show the photo to an agronomist or extension officer before you treat the bed.

## License

MIT. See [LICENSE](LICENSE).

## Running it yourself

Setup for contributors is in [docs/development.md](docs/development.md).
