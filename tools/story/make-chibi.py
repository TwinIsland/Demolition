"""Cuts the act 2 characters out of the painted sheet into src/story/assets/chibi.png.

    python3 tools/story/make-chibi.py <sheet.png>

The sheet is two rows on black (Zero, then the pink robot), each with fourteen figures: three
walk frames facing down, left, right and up, a victory pose, and the figure trapped in a bubble.
The output is 14 x 2 frames of 32 x 32 in that order, feet on the same line in every walk frame.
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

FRAME = 32
FEET = 30  # y of the soles inside a frame
HEIGHT = 28  # pixels a standing figure is scaled to
KEY = (255, 0, 255)
CLOSE = 17  # odd, in sheet pixels
OUT = Path(__file__).resolve().parents[2] / "src/story/assets/chibi.png"


def runs(flags, gap):
    """Index ranges where `flags` is set, merging breaks shorter than `gap`."""
    found, start, last = [], None, None
    for i, flag in enumerate(flags):
        if not flag:
            continue
        if start is None:
            start = i
        elif i - last > gap:
            found.append((start, last + 1))
            start = i
        last = i
    if start is not None:
        found.append((start, last + 1))
    return found


def main(path):
    sheet = Image.open(path).convert("RGB")
    keyed = sheet.copy()
    # The background is a near-black with some noise; the figures are outlined, so a fill from
    # the corner stops at them even where the clothes are black too.
    ImageDraw.floodfill(keyed, (0, 0), KEY, thresh=18)
    solid = ~np.all(np.asarray(keyed) == KEY, axis=2)
    bands = runs(solid.sum(1) > 0, 20)
    assert len(bands) == 2, bands
    # Columns come from Zero's row: the robot's frames stand in the same places.
    columns = runs(solid[bands[0][0] : bands[0][1]].sum(0) > 0, 6)
    assert len(columns) == 14, columns

    # Black trousers have no outline against the black: closing the mask gives them back. It is
    # done one figure at a time, after the columns are known, so that neighbours do not merge.
    raw = solid.copy()
    for top, bottom in bands:
        for left, right in columns:
            area = (slice(max(0, top - CLOSE), bottom + CLOSE), slice(max(0, left - 3), right + 3))
            mask = Image.fromarray(solid[area].astype(np.uint8) * 255)
            closed = mask.filter(ImageFilter.MaxFilter(CLOSE)).filter(ImageFilter.MinFilter(CLOSE))
            solid[area] |= np.asarray(closed) > 0
    rgba = np.dstack([np.asarray(sheet), solid.astype(np.uint8) * 255])

    out = Image.new("RGBA", (FRAME * 14, FRAME * 2))
    for row, (top, bottom) in enumerate(bands):
        boxes = []
        for left, right in columns:
            cell = raw[top:bottom, max(0, left - 6) : right + 6]
            ys = np.flatnonzero(cell.sum(1))
            xs = np.flatnonzero(cell.sum(0))
            boxes.append((max(0, left - 6) + xs[0], top + ys[0], max(0, left - 6) + xs[-1] + 1, top + ys[-1] + 1))
        standing = boxes[0][3] - boxes[0][1]
        scale = HEIGHT / standing
        floor = max(box[3] for box in boxes[:12])
        for index, (x0, y0, x1, y1) in enumerate(boxes):
            cut = Image.fromarray(rgba[y0:y1, x0:x1], "RGBA")
            size = (max(1, round((x1 - x0) * scale)), max(1, round((y1 - y0) * scale)))
            small = np.asarray(cut.convert("RGBa").resize(size, Image.BOX).convert("RGBA")).copy()
            small[..., 3] = np.where(small[..., 3] >= 128, 255, 0)
            small = Image.fromarray(small, "RGBA")
            x = index * FRAME + (FRAME - size[0]) // 2
            # Walk and victory frames stand on the floor line; the bubble is centred.
            y = (FRAME - size[1]) // 2 if index == 13 else FEET - round((floor - y0) * scale)
            out.paste(small, (x, row * FRAME + max(0, y)))
    out.save(OUT, optimize=True)
    print(OUT, out.size)


if __name__ == "__main__":
    main(sys.argv[1])
