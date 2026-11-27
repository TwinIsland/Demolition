"""Textures for the Flatland starter village.

The photographed surfaces come from Poly Haven (CC0) through its public API: dry-stone wall,
cedar boards, roof tiles, thatch, plaster, two kinds of paving and cherry bark. Three sheets are
drawn here: the blossom clumps of the cherry crowns, the paper screens of the houses, and the
boards that carry writing (the notice at the village gate, the shop curtain, the shrine tablet).

Run from the repository root:  python3 scripts/make-village-textures.py
Needs numpy and Pillow, and a CJK font for the writing.
"""

import io
import json
import math
import random
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path("public/assets/surfaces")
CACHE = Path(".guard/polyhaven")
API = "https://api.polyhaven.com/files/"
FONT = "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"


def fetch(asset: str, kind: str, res: str = "1k") -> Image.Image:
    CACHE.mkdir(parents=True, exist_ok=True)
    listing = CACHE / f"{asset}.json"
    if not listing.exists():
        request = urllib.request.Request(API + asset, headers={"User-Agent": "asset-fetch"})
        listing.write_bytes(urllib.request.urlopen(request).read())
    file = CACHE / f"{asset}_{kind}_{res}.jpg"
    if not file.exists():
        url = json.loads(listing.read_text())[kind][res]["jpg"]["url"]
        request = urllib.request.Request(url, headers={"User-Agent": "asset-fetch"})
        file.write_bytes(urllib.request.urlopen(request).read())
    return Image.open(io.BytesIO(file.read_bytes()))


def save(image: Image.Image, name: str, quality: int = 84) -> None:
    image.save(OUT / f"{name}.webp", quality=quality, method=6, exact=True)
    print(f"{name}.webp", (OUT / f"{name}.webp").stat().st_size // 1024, "KB")


def grade(image: Image.Image, saturation=1.0, gain=1.0, tint=(1.0, 1.0, 1.0)) -> Image.Image:
    """Pull a photograph towards grey, then brighten and tint it."""
    data = np.asarray(image.convert("RGB")).astype(np.float32) / 255
    grey = data @ np.array([0.299, 0.587, 0.114], np.float32)
    data = grey[..., None] + (data - grey[..., None]) * saturation
    data = data * gain * np.array(tint, np.float32)
    return Image.fromarray((np.clip(data, 0, 1) * 255).astype(np.uint8))


def surface(asset: str, name: str, **look) -> None:
    save(grade(fetch(asset, "Diffuse"), **look), f"{name}_diff", 86)
    save(fetch(asset, "nor_gl").convert("RGB"), f"{name}_nor", 80)
    save(fetch(asset, "Rough").convert("L").resize((512, 512), Image.LANCZOS), f"{name}_rough", 75)


def bleed(rgba: Image.Image, rounds: int = 6) -> Image.Image:
    """Spread the colour of opaque texels into the transparent ones around them."""
    data = np.asarray(rgba).astype(np.float32) / 255
    alpha = data[..., 3]
    weight = (alpha > 0.5).astype(np.float32)
    colour = data[..., :3] * weight[..., None]
    for step in range(rounds):
        blurred = np.asarray(
            Image.fromarray((np.dstack([colour, weight]) * 255).astype(np.uint8)).filter(
                ImageFilter.GaussianBlur(2 ** step)
            )
        ).astype(np.float32) / 255
        spread = blurred[..., 3]
        fill = blurred[..., :3] / np.maximum(spread, 1e-4)[..., None]
        take = (weight < 0.5) & (spread > 0.004)
        colour[take] = fill[take]
        weight[take] = 1
    colour[weight < 0.5] = colour[weight > 0.5].mean(axis=0)
    return Image.fromarray((np.clip(np.dstack([colour, alpha]), 0, 1) * 255).astype(np.uint8), "RGBA")


def blossom(draw: ImageDraw.ImageDraw, x: float, y: float, radius: float, turn: float, shade: float) -> None:
    """One five-petalled flower, seen more or less face on."""
    pale = (int(255 * shade), int(214 * shade), int(226 * shade), 255)
    deep = (int(240 * shade), int(150 * shade), int(178 * shade), 255)
    for petal in range(5):
        angle = turn + petal * math.tau / 5
        cx, cy = x + math.cos(angle) * radius * 0.55, y + math.sin(angle) * radius * 0.55
        r = radius * 0.5
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=pale)
    r = radius * 0.3
    draw.ellipse((x - r, y - r, x + r, y + r), fill=deep)


def sakura_crown() -> None:
    """Four clumps of blossom on one sheet; every crown card shows one of them."""
    rng = random.Random(410)
    size, half = 1024, 512
    sheet = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    for cell in range(4):
        clump = Image.new("RGBA", (half, half), (0, 0, 0, 0))
        draw = ImageDraw.Draw(clump)
        # A few twigs first, so the flowers sit on something.
        for _ in range(5):
            angle = rng.uniform(0, math.tau)
            reach = rng.uniform(120, 215)
            draw.line(
                (half / 2, half / 2, half / 2 + math.cos(angle) * reach, half / 2 + math.sin(angle) * reach),
                fill=(74, 50, 46, 255),
                width=rng.choice((3, 4, 5)),
            )
        # Flowers thin out towards the rim, so cards overlap without showing their square.
        for index in range(520):
            angle = rng.uniform(0, math.tau)
            reach = 232 * math.sqrt(rng.random()) ** 1.25
            if rng.random() < (reach / 232) ** 3 * 0.75:
                continue
            blossom(
                draw,
                half / 2 + math.cos(angle) * reach,
                half / 2 + math.sin(angle) * reach,
                rng.uniform(9, 17),
                rng.uniform(0, math.tau),
                0.72 + 0.28 * index / 520,
            )
        sheet.paste(clump, ((cell % 2) * half, (cell // 2) * half))
    save(bleed(sheet), "sakura-crown_diff", 88)


def wood_board(width: int, height: int, colour=(196, 160, 112)) -> Image.Image:
    """Planed boards under writing: the cedar scan, cropped and warmed."""
    boards = fetch("japanese_cedar_planks", "Diffuse").convert("RGB").rotate(90).resize((width, width))
    boards = grade(boards.crop((0, 0, width, height)), saturation=0.45, gain=1.0)
    data = np.asarray(boards).astype(np.float32) / 255
    data = data / data.mean() * (np.array(colour, np.float32) / 255)
    return Image.fromarray((np.clip(data, 0, 1) * 255).astype(np.uint8))


def written(image: Image.Image, text: str, box, ink=(34, 26, 22), vertical=False) -> None:
    """Brush-heavy writing fitted into `box` (left, top, right, bottom)."""
    left, top, right, bottom = box
    count = len(text)
    size = int(min((bottom - top) / count, right - left) if vertical else min((right - left) / count, bottom - top))
    font = ImageFont.truetype(FONT, int(size * 0.94))
    layer = Image.new("L", image.size, 0)
    draw = ImageDraw.Draw(layer)
    for index, glyph in enumerate(text):
        if vertical:
            x, y = (left + right) / 2, top + (index + 0.5) * (bottom - top) / count
        else:
            x, y = left + (index + 0.5) * (right - left) / count, (top + bottom) / 2
        draw.text((x, y), glyph, font=font, fill=255, anchor="mm", stroke_width=max(1, size // 34))
    # Ink soaks into the grain a little.
    layer = layer.filter(ImageFilter.GaussianBlur(0.8))
    image.paste(Image.new("RGB", image.size, ink), mask=layer)


def writing_sheet() -> None:
    """
    Everything with writing on it, on one 1024 sheet:
    the notice board (top, 1024 x 384), the shop curtain (512 x 256), the shrine tablet and the
    dojo board (256 x 384 each), and a paper lantern's band.
    """
    sheet = Image.new("RGB", (1024, 1024), (30, 30, 30))
    notice = wood_board(1024, 384)
    draw = ImageDraw.Draw(notice)
    draw.rectangle((10, 10, 1013, 373), outline=(70, 48, 34), width=6)
    written(notice, "欢迎来到平面国", (60, 70, 964, 250))
    written(notice, "FLATLAND · 新手村 · 人口 16 × 16", (250, 276, 774, 330), ink=(92, 40, 30))
    sheet.paste(notice, (0, 0))
    # Indigo cloth with a white mark, cut into three flaps by the model.
    curtain = Image.new("RGB", (512, 256), (38, 52, 96))
    weave = np.random.default_rng(7).normal(0, 5, (256, 512, 1))
    curtain = Image.fromarray(np.clip(np.asarray(curtain).astype(np.float32) + weave, 0, 255).astype(np.uint8))
    written(curtain, "技能屋", (40, 40, 472, 216), ink=(236, 232, 220))
    sheet.paste(curtain, (0, 384))
    tablet = wood_board(256, 384, (60, 44, 34))
    ImageDraw.Draw(tablet).rectangle((8, 8, 247, 375), outline=(196, 160, 80), width=8)
    written(tablet, "升维", (40, 40, 216, 344), ink=(214, 178, 92), vertical=True)
    sheet.paste(tablet, (512, 384))
    board = wood_board(256, 384, (206, 176, 128))
    written(board, "示例道场", (50, 24, 206, 360), vertical=True)
    sheet.paste(board, (768, 384))
    # A red paper lantern's skin: ribs and a black band, wrapped once around it.
    lantern = Image.new("RGB", (512, 256), (196, 44, 34))
    draw = ImageDraw.Draw(lantern)
    for rib in range(0, 256, 20):
        draw.line((0, rib, 512, rib), fill=(150, 30, 26), width=2)
    draw.rectangle((0, 0, 512, 22), fill=(24, 22, 22))
    draw.rectangle((0, 234, 512, 256), fill=(24, 22, 22))
    written(lantern, "祭", (190, 60, 322, 196), ink=(250, 240, 220))
    sheet.paste(lantern, (0, 640))
    save(sheet, "village-writing_diff", 90)


def shoji() -> None:
    """A paper screen: warm paper behind a dark lattice, three panes wide and four high."""
    size = 512
    rng = np.random.default_rng(12)
    paper = np.full((size, size, 3), (244, 232, 204), np.float32) + rng.normal(0, 3.5, (size, size, 1))
    image = Image.fromarray(np.clip(paper, 0, 255).astype(np.uint8))
    draw = ImageDraw.Draw(image)
    bar = (58, 40, 30)
    for i in range(4):
        x = round(i * size / 3)
        draw.rectangle((x - 7, 0, x + 7, size), fill=bar)
    for i in range(5):
        y = round(i * size / 4)
        draw.rectangle((0, y - 6, size, y + 6), fill=bar)
    save(image, "village-shoji_diff", 88)


if __name__ == "__main__":
    surface("japanese_stone_wall", "village-stone", gain=1.08)
    # Fired clay photographed red: greyed and cooled into the smoked tile of a Japanese roof.
    surface("roof_09", "village-roof", saturation=0.12, gain=0.78, tint=(0.92, 0.98, 1.08))
    surface("thatch_roof_angled", "village-thatch", gain=1.35, tint=(1.08, 1.0, 0.86))
    surface("white_plaster_02", "village-plaster", saturation=0.6, gain=1.5)
    surface("japanese_cedar_planks", "village-cedar", saturation=0.5, gain=0.62)
    surface("stone_pathway", "village-path", gain=1.1)
    surface("cobblestone_floor_08", "village-cobble", saturation=0.8, gain=0.92)
    surface("sakura_bark", "sakura-bark")
    sakura_crown()
    writing_sheet()
    shoji()
