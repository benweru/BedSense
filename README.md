# BedSense

BedSense is a phone-first check for any vegetable farm bed. Name the plant, then photograph a bed, a leaf, or fruit in your hand. The photo is read, and you get exactly three next checks.

It works well with onion, and is often used for beetroot and chili. Those are common crops, each grown on its own bed. Onion and beetroot are never on the same bed. Chili is a separate bed as well. Any other farm plant is welcome.

You can add optional context: plant age or stage, current practices, chemicals already used, recent weather or irrigation, known issues, or a note. If a clearer check needs one more fact, the result asks for it.

## Who it is for

Farmers on small vegetable beds, and the extension officers who walk those beds with them, when someone needs a second look before the bed is treated.

BedSense is an indie entry for the **Meta Global AI Developer Hackathon**, **Indie** track, **Build for Your World**.

## What a photo becomes

[SAM 3.1](https://dev.meta.ai/docs/sam/segmenting) marks the plant you named, plus yellow leaves and weeds. It does not look for a crop from another bed. A photo is one bed, or a close-up of that plant. Onion, beetroot, and chili are grown on different beds, so more than one of them in a frame is unusual, not the planting pattern. [Muse Spark](https://dev.meta.ai/docs/models) reads the photo, the plant name, and those marks. Empty marks on a close-up do not skip the check. The screen is in English or Kiswahili.

When the photo or your notes show curling, spots, wilting, yellowing, insects, or deformed growth, the result adds likely causes. When a product would help, it lists chemicals and Kenyan agrovet shops with indicative KES price bands by quality.

## Three checks, not a diagnosis

Muse returns exactly three next checks. They are practical things to look at or do next. Likely causes are hypotheses, not a diagnosis, and not a treatment rate or a spray dose. An agronomist, extension officer, or licensed agrovet confirms any product and the label before you treat the bed.

## License

MIT. See [LICENSE](LICENSE).

## Running it yourself

Setup for contributors is in [docs/development.md](docs/development.md).
