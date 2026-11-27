"""Textures for the Rainforest map's scanned plants, rocks and ground.

Everything comes from Poly Haven (CC0) through its public API. Plant colour maps get their
separate opacity map packed into the alpha channel, with the leaf colour bled outwards so
mip-mapped edges do not turn dark. The tree-crown atlas is composed here from single scanned
leaves, because a crown is drawn as a few dozen cards, not as a million leaf polygons.

Run from the repository root:  python3 scripts/make-jungle-flora.py
The matching models are written by scripts/make-jungle-flora.mjs.
"""

import io
import json
import random
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

OUT = Path("public/assets/surfaces")
CACHE = Path(".guard/polyhaven")
API = "https://api.polyhaven.com/files/"


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


def bleed(rgba: Image.Image, rounds: int = 6) -> Image.Image:
    """Spread the colour of opaque texels into the transparent ones around them."""
    data = np.asarray(rgba).astype(np.float32) / 255
    alpha = data[..., 3]
    rgb = data[..., :3]
    weight = (alpha > 0.5).astype(np.float32)
    colour = rgb * weight[..., None]
    for step in range(rounds):
        radius = 2 ** step
        blurred = np.asarray(
            Image.fromarray((np.dstack([colour, weight]) * 255).astype(np.uint8)).filter(
                ImageFilter.GaussianBlur(radius)
            )
        ).astype(np.float32) / 255
        spread = blurred[..., 3]
        fill = blurred[..., :3] / np.maximum(spread, 1e-4)[..., None]
        take = (weight < 0.5) & (spread > 0.004)
        colour[take] = fill[take]
        weight[take] = 1
    colour[weight < 0.5] = colour[weight > 0.5].mean(axis=0)
    out = np.dstack([colour, alpha])
    return Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8), "RGBA")


def save(image: Image.Image, name: str, quality: int = 84) -> None:
    image.save(OUT / f"{name}.webp", quality=quality, method=6, exact=True)
    print(f"{name}.webp", (OUT / f"{name}.webp").stat().st_size // 1024, "KB")


def plant(asset: str, name: str, prefix: str = "", gain: float = 1.0) -> None:
    """A scanned plant: colour with opacity, normal and roughness."""
    diff = fetch(asset, prefix + ("diff" if prefix else "Diffuse")).convert("RGB")
    alpha = fetch(asset, prefix + ("alpha" if prefix else "Alpha")).convert("L")
    if gain != 1.0:
        diff = Image.fromarray(np.clip(np.asarray(diff).astype(np.float32) * gain, 0, 255).astype(np.uint8))
    rgba = diff.copy()
    rgba.putalpha(alpha)
    save(bleed(rgba), f"{name}_diff", 88)
    save(fetch(asset, prefix + "nor_gl").convert("RGB"), f"{name}_nor", 80)
    rough = fetch(asset, prefix + ("rough" if prefix else "Rough")).convert("L")
    save(rough.resize((512, 512), Image.LANCZOS), f"{name}_rough", 75)


def ground(asset: str, name: str, tint=(1.0, 1.0, 1.0)) -> None:
    diff = np.asarray(fetch(asset, "Diffuse").convert("RGB")).astype(np.float32)
    diff = np.clip(diff * np.array(tint, dtype=np.float32), 0, 255).astype(np.uint8)
    save(Image.fromarray(diff), f"{name}_diff", 84)
    save(fetch(asset, "nor_gl").convert("RGB"), f"{name}_nor", 80)
    save(fetch(asset, "Rough").convert("L").resize((512, 512), Image.LANCZOS), f"{name}_rough", 75)


def rock(asset: str, name: str, gain: float = 1.0, res: str = "1k") -> None:
    listing_kinds = {"diff": "Diffuse", "nor": "nor_gl", "rough": "Rough"}
    for suffix, kind in listing_kinds.items():
        image = fetch(asset, kind, res)
        if suffix == "rough":
            image = image.convert("L").resize((512, 512), Image.LANCZOS)
        else:
            image = image.convert("RGB")
        if suffix == "diff" and gain != 1.0:
            # Scans are lit flat and come out dark; lift them to sit with the other surfaces.
            lifted = np.asarray(image).astype(np.float32) / 255
            image = Image.fromarray((np.clip(lifted ** 0.8 * gain, 0, 1) * 255).astype(np.uint8))
        save(image, f"{name}_{suffix}", 82)


def crown() -> None:
    """Four clumps of leaves on one sheet. Each crown card shows one of them."""
    random.seed(7)
    hands_rgb = fetch("pachira_aquatica_01", "leaves_diff", "2k").convert("RGB")
    hands_a = fetch("pachira_aquatica_01", "leaves_alpha", "2k").convert("L")
    hands = hands_rgb.copy()
    hands.putalpha(hands_a)
    w, h = hands.size
    # Where the four five-fingered leaves sit on the scan, as fractions of the sheet.
    boxes = [(0.03, 0.04, 0.47, 0.53), (0.49, 0.04, 0.86, 0.45), (0.02, 0.46, 0.47, 0.98), (0.49, 0.46, 0.8, 0.9)]
    sprites = [hands.crop((int(a * w), int(b * h), int(c * w), int(d * h))) for a, b, c, d in boxes]
    cell = 1024
    sheet = Image.new("RGBA", (cell * 2, cell * 2), (0, 0, 0, 0))
    for index in range(4):
        clump = Image.new("RGBA", (cell, cell), (0, 0, 0, 0))
        count = 36
        for layer in range(count):
            depth = layer / (count - 1)
            sprite = random.choice(sprites)
            size = int(cell * random.uniform(0.3, 0.46))
            sprite = sprite.resize((size, int(size * sprite.height / sprite.width)), Image.LANCZOS)
            sprite = sprite.rotate(random.uniform(0, 360), expand=True, resample=Image.BICUBIC)
            # Leaves at the back sit in the shade of those in front.
            shade = 0.34 + 0.66 * depth ** 1.4
            pixels = np.asarray(sprite).astype(np.float32)
            pixels[..., :3] *= shade * np.array([0.92, 1.0, 0.86], dtype=np.float32)
            sprite = Image.fromarray(np.clip(pixels, 0, 255).astype(np.uint8), "RGBA")
            # Dense in the middle, ragged towards the rim; nothing touches the edge of the cell.
            radius = cell * 0.34 * random.random() ** 0.55
            angle = random.uniform(0, 6.283)
            x = int(cell / 2 + np.cos(angle) * radius - sprite.width / 2)
            y = int(cell / 2 + np.sin(angle) * radius - sprite.height / 2)
            x = max(8, min(cell - sprite.width - 8, x))
            y = max(8, min(cell - sprite.height - 8, y))
            clump.alpha_composite(sprite, (x, y))
        sheet.alpha_composite(clump, ((index % 2) * cell, (index // 2) * cell))
    sheet = sheet.resize((1024, 1024), Image.LANCZOS)
    # A hard edge survives mip-mapping better than the soft one resizing leaves behind.
    alpha = sheet.getchannel("A").point(lambda v: 255 if v > 96 else 0)
    sheet.putalpha(alpha)
    save(bleed(sheet), "jungle-crown_diff", 86)


if __name__ == "__main__":
    plant("fern_02", "fern")
    plant("calathea_orbifolia_01", "calathea")
    plant("anthurium_botany_01", "anthurium")
    plant("shrub_03", "shrub")
    # Six rocks share this sheet and stand as tall as a wall, so it is the one 2k set.
    rock("rock_moss_set_01", "scan-rock", 1.0, "2k")
    ground("forest_leaves_03", "jungle-litter")
    ground("mud_forest", "jungle-mud")
    crown()
