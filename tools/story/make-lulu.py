"""Cuts Lulu's dialogue portraits out of her character sheet.

    python3 tools/story/make-lulu.py [character-sheet.png]

The sheet (default tools/story/lulu-sheet.png) is Tianyi's reference art; its bottom row holds the
three expression close-ups. Writes transparent src/story/assets/lulu-<mood>.png (40 x 40). Her in-game skin is
drawn by tools/skin-forge/story.py.
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / "src" / "story" / "assets"
BACKDROP = (42, 36, 64)
# mood: (left, top, right) of a square crop, as fractions of the sheet's width / height / width
MOODS = {"pout": (0.0815, 0.5755, 0.2887), "flustered": (0.3964, 0.5755, 0.6036), "impressed": (0.7113, 0.5755, 0.9185)}


def transparent_background(image):
    image = image.convert("RGBA")
    width, height = image.size
    pixels = image.load()
    # Hair divides the backdrop into separate regions, including the bottom corners.
    # Start at every edge; enclosed white eyes and highlights must remain opaque.
    pending = [(x, y) for x in range(width) for y in (0, height - 1)]
    pending += [(x, y) for y in range(height) for x in (0, width - 1)]
    seen = set()
    while pending:
        x, y = pending.pop()
        if not (0 <= x < width and 0 <= y < height) or (x, y) in seen:
            continue
        seen.add((x, y))
        rgb = pixels[x, y][:3]
        white = min(rgb) >= 180 and max(rgb) - min(rgb) <= 35
        if not white:
            continue
        pixels[x, y] = (*rgb, 0)
        pending.extend(((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)))
    return image


def portraits(sheet_path: str):
    sheet = Image.open(sheet_path).convert("RGB")
    width, height = sheet.size
    for mood, (x0, y0, x1) in MOODS.items():
        size = int((x1 - x0) * width)
        crop = sheet.crop((int(x0 * width), int(y0 * height), int(x0 * width) + size, int(y0 * height) + size))
        # Extract alpha before downsampling, so pale background fringes cannot become solid pixels.
        alpha = transparent_background(crop).getchannel("A").resize((40, 40), Image.BOX)
        alpha = alpha.point(lambda value: 255 if value >= 128 else 0)
        for corner in ((0, 0), (size - 1, 0)):
            ImageDraw.floodfill(crop, corner, BACKDROP, thresh=40)
        small = crop.resize((40, 40), Image.BOX).quantize(24, dither=Image.Dither.NONE)
        small = small.convert("RGBA")
        small.putalpha(alpha)
        small.save(OUT / f"lulu-{mood}.png")


if __name__ == "__main__":
    portraits(sys.argv[1] if len(sys.argv) > 1 else str(HERE / "lulu-sheet.png"))
