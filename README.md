# BedSense

BedSense is a phone-first check for any vegetable farm bed. Photograph any farm plant. You do not pick a crop first. The photo is read, the plant is named, and you get exactly three next checks.

It works well with onion, and is often used for beetroot and chili. Those are common crops, each grown on its own bed. Onion and beetroot are never on the same bed. Chili is a separate bed as well. Any other farm plant is welcome.

You can add optional context: plant age or stage, current practices, chemicals already used, recent weather or irrigation, known issues, or a note. If a clearer check needs one more fact, the result asks for it.

## Who it is for

Farmers on small vegetable beds, and the extension officers who walk those beds with them, when someone needs a second look before the bed is treated.

BedSense is an indie entry for the **Meta Global AI Developer Hackathon**, **Indie** track, **Build for Your World**.

## What a photo becomes

[SAM 3.1](https://dev.meta.ai/docs/sam/segmenting) marks onion, beetroot, chili, other vegetable plants, yellow leaves, and weeds. A photo is one bed. Onion, beetroot, and chili are grown on different beds, so more than one of them in a frame is unusual, not the planting pattern. [Muse Spark](https://dev.meta.ai/docs/models) reads the photo and those marks, names the plant, and returns exactly three next checks. A next check is a practical, non-chemical thing to look at or do next on the bed — a triage step. The screen is in English or Kiswahili.

## Three checks, not a diagnosis

Muse returns exactly three next checks. They are three practical, non-chemical things to look at or do next on the bed. They are triage steps. They are not a diagnosis, and they are not a treatment rate or a spray dose. BedSense does not name a disease as a fact. Every result asks you to show the photo to an agronomist or extension officer before you treat the bed.

## License

MIT. See [LICENSE](LICENSE).

## Running it yourself

Setup for contributors is in [docs/development.md](docs/development.md).
