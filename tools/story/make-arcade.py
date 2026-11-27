"""Builds the art of the act 2 mini-game from the owner's paintings.

    python3 tools/story/make-arcade.py <tileset.png> <crt-frame.png>

tileset.png holds sprites on black, in three rows: grass, checker floor, pillar, crate, gift box /
three bubble frames, blast centre, blast arm, blast end / speed, range and extra-bubble pickups.
They are found by their bounding boxes and scaled to 16 x 16 frames, eight per row, in that order
(src/story/assets/arcade.png).

crt-frame.png is the monitor with a chroma-green screen. It is cropped around the monitor, the
screen is cut out, and the result is laid over the game canvas (src/story/assets/crt.png). SCREEN
below is where the hole ends up, as fractions of the stage; story.css places the canvas there.
"""

import sys
from pathlib import Path

from PIL import Image

OUT = Path(__file__).resolve().parents[2] / "src" / "story" / "assets"
S = 16


def runs(flags, gap):
    """Index ranges where `flags` is set, merging ranges closer than `gap`."""
    found, start, last = [], None, None
    for index, flag in enumerate(flags):
        if not flag:
            continue
        if start is None:
            start = index
        elif index - last > gap:
            found.append((start, last + 1))
            start = index
        last = index
    if start is not None:
        found.append((start, last + 1))
    return found


def sprites(path):
    image = Image.open(path).convert("RGB")
    width, height = image.size
    lit = image.point(lambda v: 255 if v > 30 else 0).convert("L")
    pixels = lit.load()
    rows = runs([any(pixels[x, y] for x in range(0, width, 2)) for y in range(height)], 24)
    cut = []
    for top, bottom in rows:
        columns = runs([any(pixels[x, y] for y in range(top, bottom, 2)) for x in range(width)], 14)
        cut.append([image.crop((left, top, right, bottom)) for left, right in columns])
    return cut


def keyed(sprite):
    """Black becomes transparent."""
    rgba = sprite.convert("RGBA")
    rgba.putdata([(r, g, b, 0 if max(r, g, b) < 34 else 255) for r, g, b, _ in rgba.getdata()])
    return rgba


def fit(sprite, width=S, height=S, bottom=False):
    """Scales into a frame, keeping proportions; centred, or standing on the bottom edge."""
    scale = min(width / sprite.width, height / sprite.height)
    size = (max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale)))
    small = keyed(sprite).resize(size, Image.BOX)
    small.putdata([(r, g, b, 255 if a > 110 else 0) for r, g, b, a in small.getdata()])
    frame = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    frame.alpha_composite(small, ((S - size[0]) // 2, S - size[1] if bottom else (S - size[1]) // 2))
    return frame


def floor(sprite):
    """A ground tile fills its frame: the rounded corners of the painting are trimmed off."""
    inset = round(sprite.width * 0.07)
    return sprite.crop((inset, inset, sprite.width - inset, sprite.height - inset)).resize((S, S), Image.BOX).convert("RGBA")


def arcade_sheet(path):
    tiles, effects, pickups = sprites(path)
    assert (len(tiles), len(effects), len(pickups)) == (5, 6, 3), "unexpected tileset layout"
    frames = [
        floor(tiles[0]),
        floor(tiles[1]),
        *(fit(tile) for tile in tiles[2:]),
        *(fit(bubble, bottom=True) for bubble in effects[:3]),
        fit(effects[3]),
        # The arm and the cap keep their thickness and span the whole cell, so arms join up.
        *(keyed(piece).resize((S, 10), Image.BOX) for piece in effects[4:]),
        *(fit(pickup) for pickup in pickups),
    ]
    sheet = Image.new("RGBA", (S * 8, S * 2), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        if frame.size != (S, S):
            strip = Image.new("RGBA", (S, S), (0, 0, 0, 0))
            strip.alpha_composite(frame, (0, (S - frame.height) // 2))
            frame = strip
        sheet.alpha_composite(frame, ((index % 8) * S, (index // 8) * S))
    sheet.save(OUT / "arcade.png")


# Part of the painting kept (the monitor), and its green screen, in source pixels.
CROP = (280, 95, 1380, 714)
SCREEN = (515, 175, 1145, 620)


def crt_frame(path):
    image = Image.open(path).convert("RGBA").crop(CROP)
    left, top, right, bottom = (SCREEN[0] - CROP[0], SCREEN[1] - CROP[1], SCREEN[2] - CROP[0], SCREEN[3] - CROP[1])
    pixels = image.load()
    for y in range(top - 8, bottom + 8):
        for x in range(left - 8, right + 8):
            r, g, b, _ = pixels[x, y]
            if g > 110 and g > r * 1.5 and g > b * 1.5:
                pixels[x, y] = (0, 0, 0, 0)
    image.resize((640, 360), Image.BOX).save(OUT / "crt.png")
    w, h = image.size
    print("screen: left %.2f%% top %.2f%% width %.2f%% height %.2f%%" % (100 * left / w, 100 * top / h, 100 * (right - left) / w, 100 * (bottom - top) / h))


if __name__ == "__main__":
    arcade_sheet(sys.argv[1])
    crt_frame(sys.argv[2])
