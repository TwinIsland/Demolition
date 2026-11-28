"""Cuts the painted sheets of the 8-bit rooms into game sprites and builds their tile sheet.

    python3 tools/story/cut-rpg.py [source folder]

A sheet is several objects on flat magenta. Each is found as a blob, taken in reading order, named
from SHEETS, shrunk to the width given there and written to src/story/assets/rpg/<name>.png.
The material swatches are not used as pictures: their colours are sampled and the 16 px tiles are
drawn from them, so planks land on the pixel grid and repeat without a seam.
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SOURCE = Path(sys.argv[1] if len(sys.argv) > 1 else "/mnt/project-files/Demolition-story/art/rpg")
OUT = Path(__file__).resolve().parents[2] / "src/story/assets/rpg"
TILE = 16

# Sheet -> (name, width in game pixels) in reading order.
SHEETS = {
    "bedroom-furniture": [("bed", 48), ("desk", 58), ("chair", 24), ("bookshelf", 40), ("mirror", 22), ("box", 26)],
    "bedroom-wall": [("curtains-closed", 80), ("curtains-open", 80), ("door-closed", 32), ("door-open", 36)],
    "items": [
        ("tissue", 11), ("sock", 12), ("phone", 10), ("crisps", 16),
        ("clock", 12), ("power-strip", 17), ("noodles", 11), ("tissue-box", 14),
        ("gamepad", 14), ("manga", 13), ("lamp", 14), ("plush", 14),
    ],
    "dining": [
        ("fridge", 26), ("cabinet", 40), ("table", 64), ("chair-front", 20),
        ("chair-back", 20), ("calendar", 26), ("plant", 30), ("window", 64),
    ],
    "bathroom": [
        ("toilet", 20), ("sink", 28), ("bathtub", 64), ("washer", 24), ("basket", 20),
        ("wall-shelf", 24), ("figurine", 13), ("key", 10), ("lockbox", 24), ("lockbox-open", 24),
    ],
    "posters": [("poster-megumin", 32), ("poster-aqua", 32)],
}
COLORS = 32


def background(pixels: np.ndarray) -> np.ndarray:
    r, g, b = (pixels[..., i].astype(int) for i in range(3))
    return (r > 170) & (b > 170) & (g < 130) & (np.minimum(r, b) - g > 90)


def blobs(solid: np.ndarray) -> list[tuple[int, int, int, int]]:
    """Bounding boxes of the objects, in reading order. Loose parts near an object belong to it."""
    step = 4
    small = Image.fromarray((solid[::step, ::step] * 255).astype(np.uint8))
    small = small.filter(ImageFilter.MaxFilter(9)).point(lambda value: 255 if value else 0)
    boxes = []
    while True:
        data = np.array(small)
        rest = np.argwhere(data == 255)
        if not len(rest):
            break
        y, x = rest[0]
        ImageDraw.floodfill(small, (int(x), int(y)), 128)
        ys, xs = np.nonzero(np.array(small) == 128)
        small = small.point(lambda value: 0 if value == 128 else value)
        # The filter grew each blob by one step all round.
        box = ((xs.min() + 1) * step, (ys.min() + 1) * step, xs.max() * step, ys.max() * step)
        if (box[2] - box[0]) * (box[3] - box[1]) > 900:
            boxes.append(box)
    rows: list[list[tuple[int, int, int, int]]] = []
    for box in sorted(boxes, key=lambda b: (b[1] + b[3]) / 2):
        middle = (box[1] + box[3]) / 2
        if rows and rows[-1][0][1] < middle < max(b[3] for b in rows[-1]):
            rows[-1].append(box)
        else:
            rows.append([box])
    return [box for row in rows for box in sorted(row)]


def shrink(cut: np.ndarray, solid: np.ndarray, width: int) -> Image.Image:
    height = max(1, round(cut.shape[0] * width / cut.shape[1]))
    alpha = solid.astype(np.float32)
    # Colours are averaged by coverage, so the magenta around an object never bleeds into its edge.
    cover = np.array(Image.fromarray(alpha).resize((width, height), Image.BOX))
    channels = [
        np.array(Image.fromarray((cut[..., i] * alpha).astype(np.float32)).resize((width, height), Image.BOX))
        for i in range(3)
    ]
    rgb = np.stack([np.where(cover > 0, c / np.maximum(cover, 1e-6), 0) for c in channels], -1)
    rgb = np.clip(rgb, 0, 255).astype(np.uint8)
    flat = Image.fromarray(rgb).quantize(COLORS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    out = flat.convert("RGBA")
    out.putalpha(Image.fromarray(((cover >= 0.5) * 255).astype(np.uint8)))
    return out


def cut_sheet(name: str, items: list[tuple[str, int]]) -> None:
    path = SOURCE / f"{name}.png"
    if not path.exists():
        print(f"{name}: not painted yet")
        return
    pixels = np.array(Image.open(path).convert("RGB"))
    solid = ~background(pixels)
    found = blobs(solid)
    if len(found) != len(items):
        print(f"{name}: expected {len(items)} objects, found {len(found)}; check the sheet")
    for (item, width), (left, top, right, bottom) in zip(items, found):
        part = solid[top:bottom, left:right]
        ys, xs = np.nonzero(part)
        box = (left + xs.min(), top + ys.min(), left + xs.max() + 1, top + ys.max() + 1)
        sprite = shrink(
            pixels[box[1]:box[3], box[0]:box[2]].astype(np.float32), solid[box[1]:box[3], box[0]:box[2]], width
        )
        sprite.save(OUT / f"{item}.png")
        print(f"{item}: {sprite.width} x {sprite.height}")


def tones(swatch: np.ndarray, count: int) -> list[tuple[int, int, int]]:
    """The swatch's main colours, darkest first."""
    image = Image.fromarray(swatch).quantize(count, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    palette = image.getpalette()[: count * 3]
    colours = [tuple(palette[i : i + 3]) for i in range(0, count * 3, 3)]
    return sorted(colours, key=sum)


def inner(pixels: np.ndarray, left: float, right: float) -> np.ndarray:
    h, w = pixels.shape[:2]
    part = pixels[int(h * 0.06) : int(h * 0.94), int(w * left) : int(w * right)]
    return part


def planks(seam, grain, wood, joints: tuple[tuple[int, ...], tuple[int, ...]], marks) -> Image.Image:
    tile = Image.new("RGB", (TILE, TILE), wood)
    ink = ImageDraw.Draw(tile)
    for row, xs in enumerate(joints):
        top = row * 8
        ink.line([(0, top + 7), (TILE, top + 7)], fill=seam)
        for x in xs:
            ink.line([(x, top), (x, top + 6)], fill=seam)
    for x, y, length in marks:
        ink.line([(x, y), (x + length - 1, y)], fill=grain)
    return tile


def tiles() -> None:
    """Tile sheet, 16 px cells in one row; src/story/acts/bedroom-map.ts names the columns."""
    cells: list[Image.Image] = []
    path = SOURCE / "materials-bedroom.png"
    if path.exists():
        pixels = np.array(Image.open(path).convert("RGB"))
        seam, grain, wood = tones(inner(pixels, 0.03, 0.47), 3)
        cells += [
            planks(seam, grain, wood, ((), ()), [(3, 3, 4), (10, 11, 3)]),
            planks(seam, grain, wood, ((5,), ()), [(9, 2, 3), (2, 12, 4)]),
            planks(seam, grain, wood, ((), (11,)), [(4, 4, 3)]),
            planks(seam, grain, wood, ((12,), (3,)), [(6, 10, 4)]),
        ]
        h, w = pixels.shape[:2]
        fleck, plaster = tones(pixels[int(h * 0.1) : int(h * 0.85), int(w * 0.54) : int(w * 0.96)], 2)
        board = tones(pixels[int(h * 0.935) : int(h * 0.975), int(w * 0.54) : int(w * 0.96)], 2)
        plain = Image.new("RGB", (TILE, TILE), plaster)
        speck = plain.copy()
        ImageDraw.Draw(speck).point([(5, 6), (6, 5), (11, 10)], fill=fleck)
        skirt = plain.copy()
        ink = ImageDraw.Draw(skirt)
        ink.rectangle([0, 12, TILE, 15], fill=board[1])
        ink.line([(0, 12), (TILE, 12)], fill=board[0])
        ink.line([(0, 15), (TILE, 15)], fill=board[0])
        top = Image.new("RGB", (TILE, TILE), tuple(c // 4 for c in plaster))
        cells += [plain, speck, skirt, top]
    path = SOURCE / "materials-bathroom.png"
    if path.exists():
        pixels = np.array(Image.open(path).convert("RGB"))
        h, w = pixels.shape[:2]
        grout, glaze = tones(inner(pixels, 0.03, 0.47), 2)
        floor = Image.new("RGB", (TILE, TILE), glaze)
        ink = ImageDraw.Draw(floor)
        for at in (7, 15):
            ink.line([(0, at), (TILE, at)], fill=grout)
            ink.line([(at, 0), (at, TILE)], fill=grout)
        joint, white = tones(pixels[int(h * 0.4) : int(h * 0.9), int(w * 0.54) : int(w * 0.96)], 2)
        wall = Image.new("RGB", (TILE, TILE), white)
        ink = ImageDraw.Draw(wall)
        for row in range(4):
            ink.line([(0, row * 4 + 3), (TILE, row * 4 + 3)], fill=joint)
            ink.line([((row % 2) * 8 + 3, row * 4), ((row % 2) * 8 + 3, row * 4 + 2)], fill=joint)
            ink.line([((row % 2) * 8 + 11, row * 4), ((row % 2) * 8 + 11, row * 4 + 2)], fill=joint)
        stripe = wall.copy()
        accent = tones(pixels[int(h * 0.06) : int(h * 0.3), int(w * 0.54) : int(w * 0.96)], 3)[0]
        ImageDraw.Draw(stripe).rectangle([0, 4, TILE, 6], fill=accent)
        cells += [floor, wall, stripe]
    if not cells:
        return
    sheet = Image.new("RGB", (TILE * len(cells), TILE))
    for index, cell in enumerate(cells):
        sheet.paste(cell, (index * TILE, 0))
    sheet.save(OUT / "tiles.png")
    print(f"tiles: {len(cells)} cells")


OUT.mkdir(parents=True, exist_ok=True)
for sheet, names in SHEETS.items():
    cut_sheet(sheet, names)
tiles()
