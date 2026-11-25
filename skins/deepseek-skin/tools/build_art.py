#!/usr/bin/env python3
"""Derives the artwork of deepseek-skin from the maid-atelier skin of dsh-deep-whale.

The upstream artwork is CC BY-NC-SA 4.0 (see ../NOTICE.md). This script only crops, scales and re-encodes it, so
the result keeps that licence and its attribution chain.

    python3 skins/deepseek-skin/tools/build_art.py --upstream /path/to/dsh-deep-whale

Needs Pillow with WebP support. The upstream checkout should be at UPSTREAM_COMMIT; the script says so if not.
"""

from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

from PIL import Image

UPSTREAM = "https://github.com/Small-tailqwq/dsh-deep-whale"
UPSTREAM_COMMIT = "a9e2884388122be47a7c737c18b98ac4896d7c27"
OUT = Path(__file__).resolve().parent.parent / "package" / "art"


def fit_height(image: Image.Image, height: int) -> Image.Image:
    if image.height <= height:
        return image
    width = round(image.width * height / image.height)
    return image.resize((width, height), Image.LANCZOS)


def fit_box(image: Image.Image, box: int) -> Image.Image:
    image = image.crop(image.getbbox())
    image.thumbnail((box, box), Image.LANCZOS)
    square = Image.new("RGBA", (box, box), (0, 0, 0, 0))
    square.alpha_composite(image, ((box - image.width) // 2, box - image.height))
    return square


def save(image: Image.Image, name: str, quality: int = 82) -> None:
    path = OUT / name
    image.save(path, "WEBP", quality=quality, method=6)
    print(f"  {name:28} {image.width:5}x{image.height:<5} {path.stat().st_size // 1024:5} KiB")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--upstream", required=True, type=Path, help="a checkout of " + UPSTREAM)
    upstream = parser.parse_args().upstream.resolve()
    assets = upstream / "maid-atelier" / "assets"
    commit = subprocess.run(
        ["git", "-C", str(upstream), "rev-parse", "HEAD"], capture_output=True, text=True, check=True
    ).stdout.strip()
    if commit != UPSTREAM_COMMIT:
        print(f"note: upstream is at {commit}, this skin was made from {UPSTREAM_COMMIT}")
    OUT.mkdir(parents=True, exist_ok=True)
    rgba = lambda name: Image.open(assets / name).convert("RGBA")

    print(f"writing {OUT}")
    # The palace hall by day and by night: the conversation backdrop. Drawn with cover, so 1600 wide is enough.
    save(Image.open(assets / "maid-atelier-palace-day-v4.webp").convert("RGB"), "palace-day.webp", 78)
    save(Image.open(assets / "maid-atelier-palace-night-v4.webp").convert("RGB"), "palace-night.webp", 78)

    # The two whale maids standing either side of the conversation; shown at most ~900px high, so 1500 is 2x-ish.
    save(fit_height(rgba("maid-atelier-maid-left-v5.webp").crop(rgba("maid-atelier-maid-left-v5.webp").getbbox()), 1500), "maid-left.webp")
    save(fit_height(rgba("maid-atelier-maid-right-v7.webp").crop(rgba("maid-atelier-maid-right-v7.webp").getbbox()), 1500), "maid-right.webp")

    # The chibi faces of the agent's figure and the companion, one per mood. Shown at 28-64px; 192 is 3x.
    save(fit_box(rgba("icons/delighted-cutout.png"), 192), "chibi-delighted.webp", 88)
    save(fit_box(rgba("icons/determined-cutout.png"), 192), "chibi-determined.webp", 88)
    save(fit_box(rgba("icons/sleepy-cutout.png"), 192), "chibi-sleepy.webp", 88)

    # Gold corner ornaments of the sidebar: the upstream one is the top-right corner; the bottom-left is it turned.
    corner = rgba("maid-sidebar-corner-v1.webp")
    corner = corner.crop(corner.getbbox()).resize((240, 240), Image.LANCZOS)
    save(corner, "corner-top-right.webp", 90)
    save(corner.rotate(180), "corner-bottom-left.webp", 90)

    # The navy ribbon of a selected row.
    ribbon = rgba("maid-workspace-ribbon-v2.webp")
    save(ribbon.crop(ribbon.getbbox()).resize((592, 120), Image.LANCZOS), "ribbon.webp", 88)

    # The bow with its sapphire and the strip of lace, cut from the composer frame, to crown the composer.
    frame = rgba("maid-composer-frame-v4.webp")
    bow = frame.crop((728, 0, 1072, 160))
    save(bow.crop(bow.getbbox()).resize((172, 80), Image.LANCZOS), "bow.webp", 90)
    lace = frame.crop((260, 76, 700, 126))
    save(lace.resize((220, 25), Image.LANCZOS), "lace.webp", 90)

    # The sapphire crest, under the conversation when nothing is open.
    crest = rgba("maid-bottom-crest-v1.webp")
    save(fit_height(crest.crop(crest.getbbox()), 120), "crest.webp", 90)


if __name__ == "__main__":
    main()
