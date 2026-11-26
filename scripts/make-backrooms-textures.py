"""Builds the Backrooms surfaces from two Poly Haven sets (CC0) and one drawn here.

- backrooms-wall_*:    "Decrepit Wallpaper" recoloured to the yellowed paper of an old office, with
                       a faint printed stripe and motif and darker damp patches.
- backrooms-carpet_*:  "Dirty Carpet" recoloured to a worn tan loop pile.
- backrooms-ceiling_*: suspended ceiling tiles, drawn procedurally: 2 x 2 tiles per repeat, with
                       the joints a quarter in from the edge so a tile sits centred on the repeat.

Usage: python3 make-backrooms-textures.py <folder with the Poly Haven 1k JPGs> <repo root>
Needs numpy and Pillow.
"""
import sys, os, numpy as np
from PIL import Image, ImageFilter

SRC, ROOT = sys.argv[1], sys.argv[2]
OUT = os.path.join(ROOT, "public/assets/surfaces")
N = 1024
rng = np.random.default_rng(1989)


def load(name):
    return np.asarray(Image.open(os.path.join(SRC, name)).convert("RGB").resize((N, N), Image.LANCZOS)) / 255.0


def save(array, name, quality=82):
    image = Image.fromarray((np.clip(array, 0, 1) * 255 + 0.5).astype(np.uint8))
    image.save(os.path.join(OUT, name), "WEBP", quality=quality, method=6)


def luma(rgb):
    return rgb @ np.array([0.2126, 0.7152, 0.0722])


def blur(gray, radius):
    """Gaussian blur in the frequency domain: it wraps, so the result still tiles."""
    fy, fx = np.meshgrid(np.fft.fftfreq(gray.shape[0]), np.fft.fftfreq(gray.shape[1]), indexing="ij")
    return np.fft.ifft2(np.fft.fft2(gray) * np.exp(-2 * (np.pi * radius) ** 2 * (fx**2 + fy**2))).real


def tint(gray, dark, light):
    dark, light = np.array(dark) / 255.0, np.array(light) / 255.0
    return dark + (light - dark) * gray[..., None]


def normal_from_height(height, strength):
    dx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * strength
    dy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * strength
    n = np.dstack([-dx, dy, np.ones_like(height)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return n * 0.5 + 0.5


# --- Wallpaper ---------------------------------------------------------------------------------
paper = luma(load("decrepit_wallpaper_diff_1k.jpg"))
fine = paper - blur(paper, 6)  # fibres, scratches and flakes
broad = blur(paper, 40)
broad = (broad - broad.min()) / (broad.max() - broad.min())  # 0 damp and dark, 1 dry
y, x = np.mgrid[0:N, 0:N] / N
# Printed pattern: pairs of thin vertical stripes with a small lozenge between them, eight across.
u = (x * 8) % 1.0
stripe = np.exp(-(((u - 0.18) / 0.018) ** 2)) + np.exp(-(((u - 0.82) / 0.018) ** 2))
v = (y * 8 + np.floor(x * 8) % 2 * 0.5) % 1.0
lozenge = np.clip(1 - (np.abs(u - 0.5) / 0.09 + np.abs(v - 0.5) / 0.16), 0, 1) ** 0.6
printed = np.clip(stripe * 0.55 + lozenge * 0.8, 0, 1)
tone = np.clip(0.7 + 0.2 * broad + fine * 2.6, 0, 1)
wall = tint(tone, (92, 74, 30), (214, 190, 104))
wall *= (1 - 0.2 * printed)[..., None]
# Damp creeps up from the floor of each repeat as a brown wash.
stain = np.clip(0.9 - broad * 1.8, 0, 1)[..., None]
wall = wall * (1 - 0.35 * stain) + np.array([96, 74, 34]) / 255.0 * 0.35 * stain
save(wall, "backrooms-wall_diff.webp")
save(load("decrepit_wallpaper_nor_gl_1k.jpg"), "backrooms-wall_nor.webp", 80)
save(np.clip(load("decrepit_wallpaper_rough_1k.jpg") * 0.5 + 0.48, 0, 1), "backrooms-wall_rough.webp", 75)

# --- Carpet ------------------------------------------------------------------------------------
carpet = load("dirty_carpet_diff_1k.jpg")
pile = luma(carpet)
pile = (pile - np.percentile(pile, 1)) / (np.percentile(pile, 99) - np.percentile(pile, 1))
pile = np.clip(pile, 0, 1) ** 0.8
save(tint(pile, (58, 46, 24), (150, 126, 76)), "backrooms-carpet_diff.webp")
save(load("dirty_carpet_nor_gl_1k.jpg"), "backrooms-carpet_nor.webp", 80)
save(np.clip(load("dirty_carpet_rough_1k.jpg") * 0.3 + 0.7, 0, 1), "backrooms-carpet_rough.webp", 75)

# --- Ceiling tiles -----------------------------------------------------------------------------
M = 512
y, x = np.mgrid[0:M, 0:M] / M
# Distance to the nearest joint; joints run at 0.25 and 0.75.
joint = np.minimum(np.abs((x - 0.25 + 0.25) % 0.5 - 0.25), np.abs((y - 0.25 + 0.25) % 0.5 - 0.25))
rail = joint < 0.012
height = np.where(rail, 0.0, 1.0) * np.clip(joint / 0.03, 0, 1) * 0.5 + 0.5
# Fissures and pinholes of a mineral-fibre tile.
holes = rng.random((M, M)) < 0.012
holes = np.asarray(
    Image.fromarray((holes * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
) / 255.0
holes *= ~rail
grain = rng.random((M, M))
mottle = np.asarray(Image.fromarray((rng.random((M, M)) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(24))) / 255.0
shade = 0.86 + 0.05 * (grain - 0.5) + 0.3 * (mottle - 0.5) - 0.42 * holes
ceiling = tint(np.clip(shade, 0, 1), (60, 52, 34), (226, 216, 184))
ceiling[rail] = np.array([176, 168, 146]) / 255.0
# A water mark in one tile.
ring = np.hypot(x - 0.62, y - 0.58)
water = np.clip(1 - np.abs(ring - 0.11 - 0.03 * mottle) / 0.02, 0, 1) * 0.22 + np.clip(1 - ring / 0.12, 0, 1) * 0.1
water *= ~rail
ceiling = ceiling * (1 - water[..., None]) + np.array([120, 92, 44]) / 255.0 * water[..., None]
Image.fromarray((np.clip(ceiling, 0, 1) * 255).astype(np.uint8)).save(
    os.path.join(OUT, "backrooms-ceiling_diff.webp"), "WEBP", quality=84, method=6
)
relief = height - holes * 0.5 + (grain - 0.5) * 0.04
Image.fromarray((normal_from_height(relief, 3.0) * 255).astype(np.uint8)).save(
    os.path.join(OUT, "backrooms-ceiling_nor.webp"), "WEBP", quality=80, method=6
)
rough = np.where(rail, 0.55, 0.95)
Image.fromarray((np.dstack([rough] * 3) * 255).astype(np.uint8)).save(
    os.path.join(OUT, "backrooms-ceiling_rough.webp"), "WEBP", quality=70, method=6
)
