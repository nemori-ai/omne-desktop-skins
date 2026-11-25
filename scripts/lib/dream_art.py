#!/usr/bin/env python3
"""The image side of import-dream-skin.mjs (needs Pillow).

  dream_art.py unpack <package.zip> <dir>          extract a theme package, refusing paths that leave <dir>
  dream_art.py image <picture> <out.webp> [width]  re-encode the background as WebP, at most <width> wide
  dream_art.py extras <picture> <dir> <fx> <fy>    the figure medallion and the sidebar strip, cut at the focus
  dream_art.py sheet <out.jpg> <picture>...        a numbered contact sheet of previews, to choose from by eye

Each prints one line of JSON for the Node side to read.
"""

import colorsys
import json
import sys
import zipfile
from pathlib import Path

MAX_FILES = 64
MAX_BYTES = 64 * 1024 * 1024


def unpack(archive: str, target: str) -> dict:
    root = Path(target).resolve()
    root.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as package:
        entries = [entry for entry in package.infolist() if not entry.is_dir()]
        if len(entries) > MAX_FILES:
            raise SystemExit(f"the package holds {len(entries)} files; at most {MAX_FILES} are read")
        if sum(entry.file_size for entry in entries) > MAX_BYTES:
            raise SystemExit("the package unpacks to more than 64 MiB")
        names = []
        for entry in entries:
            path = (root / entry.filename).resolve()
            if root not in path.parents:
                raise SystemExit(f"the package names a path outside itself: {entry.filename}")
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(package.read(entry))
            names.append(entry.filename)
    return {"files": sorted(names)}


def image(source: str, out: str, width: int) -> dict:
    from PIL import Image, ImageOps

    with Image.open(source) as opened:
        picture = ImageOps.exif_transpose(opened).convert("RGB")
    if picture.width > width:
        picture = picture.resize((width, round(picture.height * width / picture.width)), Image.LANCZOS)
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    picture.save(out, "WEBP", quality=80, method=6)
    # The most vivid colours of the picture: an accent for a theme that names none.
    small = picture.resize((64, 36))
    pixels = list(small.getdata())
    ranked = sorted(pixels, key=lambda p: (lambda h, s, v: s * v)(*colorsys.rgb_to_hsv(*(c / 255 for c in p))), reverse=True)
    top = ranked[: max(1, len(ranked) // 10)]
    vivid = [round(sum(p[i] for p in top) / len(top)) for i in range(3)]
    return {"width": picture.width, "height": picture.height, "bytes": Path(out).stat().st_size, "vivid": "#%02x%02x%02x" % tuple(vivid)}


def _open_rgb(source: str):
    from PIL import Image, ImageOps

    with Image.open(source) as opened:
        return ImageOps.exif_transpose(opened).convert("RGB")


def _busiest_square(picture, side: int, fx: float, fy: float):
    """The top-left corner of the side x side square whose light varies most (a subject against its ground, not a
    texture such as rain, which a small copy smooths away), with its colour counted too, scored lower the further it
    sits from the focus (fx, fy); searched on a small copy in sixths of the square."""
    from PIL import ImageStat

    w, h = picture.size
    small = picture.copy()
    small.thumbnail((96, 96))
    scale = small.width / w
    light = small.convert("L")
    colour = small.convert("HSV").split()[1]
    s = max(1, round(side * scale))
    step = max(1, s // 6)
    best, corner = -1.0, (0, 0)
    diagonal = (small.width ** 2 + small.height ** 2) ** 0.5
    for y in range(0, max(1, small.height - s + 1), step):
        for x in range(0, max(1, small.width - s + 1), step):
            box = (x, y, x + s, y + s)
            mean = ImageStat.Stat(light.crop(box)).stddev[0] + 0.25 * ImageStat.Stat(colour.crop(box)).mean[0]
            cx, cy = (x + s / 2) / small.width, (y + s / 2) / small.height
            far = (((cx - fx) * small.width) ** 2 + ((cy - fy) * small.height) ** 2) ** 0.5 / diagonal
            score = mean * (1 - 0.3 * far)
            if score > best:
                best, corner = score, (x, y)
    left = min(max(0, round(corner[0] / scale)), w - side)
    top = min(max(0, round(corner[1] / scale)), h - side)
    return left, top


def extras(source: str, target: str, fx: float, fy: float) -> dict:
    """figure.webp: a round medallion of the picture's subject. sidebar.webp: a tall slice through the subject that
    fades in from nothing at the top, laid at the foot of the sidebar over its own ground."""
    from PIL import Image, ImageDraw

    picture = _open_rgb(source)
    w, h = picture.size
    out = Path(target)
    out.mkdir(parents=True, exist_ok=True)

    # The medallion: a square of half the short side, where the picture has the most to show (edges and colour),
    # pulled a little toward the theme's focus. A bare cut at the focus often lands on sky or rain.
    side = max(1, round(min(w, h) * 0.5))
    left, top = _busiest_square(picture, side, fx, fy)
    size = 192
    face = picture.crop((left, top, left + side, top + side)).resize((size * 2, size * 2), Image.LANCZOS)
    mask = Image.new("L", face.size, 0)
    ImageDraw.Draw(mask).ellipse((0, 0, face.width - 1, face.height - 1), fill=255)
    face.putalpha(mask)
    face = face.resize((size, size), Image.LANCZOS)
    face.save(out / "figure.webp", "WEBP", quality=82, method=6)

    # The strip: as tall as the picture, 0.6 of its height wide, centred on the focus; then 360 px wide.
    strip_w = max(1, min(w, round(h * 0.6)))
    strip_left = min(max(0, round(fx * w - strip_w / 2)), w - strip_w)
    strip = picture.crop((strip_left, 0, strip_left + strip_w, h))
    width = 360
    strip = strip.resize((width, max(1, round(strip.height * width / strip.width))), Image.LANCZOS)
    # Nothing in the top 35 %, then up to 55 % at the foot: the sidebar's words stay on their own ground.
    fade = Image.new("L", (1, strip.height), 0)
    start = round(strip.height * 0.35)
    for y in range(strip.height):
        t = 0 if y < start else (y - start) / max(1, strip.height - 1 - start)
        fade.putpixel((0, y), round(255 * 0.55 * t ** 1.2))
    strip.putalpha(fade.resize(strip.size))
    strip.save(out / "sidebar.webp", "WEBP", quality=78, method=6)
    return {
        "figure": (out / "figure.webp").stat().st_size,
        "sidebar": (out / "sidebar.webp").stat().st_size,
        "sidebarHeight": strip.height,
    }


def sheet(out: str, sources: list) -> dict:
    """Tiles of 480x270, four to a row, each with its number in the corner (1 is the first picture given)."""
    from PIL import Image, ImageDraw, ImageFont

    tile_w, tile_h, cols, pad = 480, 270, 4, 8
    rows = (len(sources) + cols - 1) // cols
    board = Image.new("RGB", (cols * (tile_w + pad) + pad, rows * (tile_h + pad) + pad), (24, 24, 28))
    draw = ImageDraw.Draw(board)
    try:
        font = ImageFont.load_default(size=40)
    except TypeError:  # Pillow before 10.1 has one size only
        font = ImageFont.load_default()
    unread = []
    for index, source in enumerate(sources):
        x = pad + (index % cols) * (tile_w + pad)
        y = pad + (index // cols) * (tile_h + pad)
        try:
            picture = _open_rgb(source)
        except Exception as error:  # one unreadable preview leaves its tile dark and is reported
            unread.append({"index": index + 1, "why": str(error)})
            continue
        scale = max(tile_w / picture.width, tile_h / picture.height)
        shown = picture.resize((max(tile_w, round(picture.width * scale)), max(tile_h, round(picture.height * scale))), Image.LANCZOS)
        left, top = (shown.width - tile_w) // 2, (shown.height - tile_h) // 2
        board.paste(shown.crop((left, top, left + tile_w, top + tile_h)), (x, y))
        label = str(index + 1)
        box = draw.textbbox((0, 0), label, font=font)
        draw.rectangle((x, y, x + box[2] - box[0] + 24, y + box[3] - box[1] + 20), fill=(0, 0, 0))
        draw.text((x + 12 - box[0], y + 10 - box[1]), label, fill=(255, 255, 255), font=font)
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    board.save(out, "JPEG", quality=82)
    return {"tiles": len(sources), "unread": unread, "bytes": Path(out).stat().st_size}


def main(argv: list) -> None:
    if len(argv) >= 3 and argv[0] == "unpack":
        print(json.dumps(unpack(argv[1], argv[2])))
    elif len(argv) >= 3 and argv[0] == "image":
        print(json.dumps(image(argv[1], argv[2], int(argv[3]) if len(argv) > 3 else 2048)))
    elif len(argv) == 5 and argv[0] == "extras":
        print(json.dumps(extras(argv[1], argv[2], float(argv[3]), float(argv[4]))))
    elif len(argv) >= 3 and argv[0] == "sheet":
        print(json.dumps(sheet(argv[1], argv[2:])))
    else:
        raise SystemExit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
