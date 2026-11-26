"""Builds the Poolrooms tile textures: glazed white wall and deck tiles, and the small blue
mosaic that lines the pools. Each set is a colour, a normal (OpenGL) and a roughness map that
tile seamlessly.

Usage: python3 make-pool-textures.py <repo root>
Needs numpy and Pillow.
"""
import sys, os, numpy as np
from PIL import Image

ROOT = sys.argv[1]
SIZE = 512
rng = np.random.default_rng(2026)


def periodic_noise(octaves, falloff=0.55):
    """Smooth noise that wraps at the texture edge, 0..1."""
    total = np.zeros((SIZE, SIZE))
    amplitude = 1.0
    for octave in range(octaves):
        cells = 4 * 2 ** octave
        grid = rng.random((cells, cells))
        big = np.asarray(Image.fromarray((grid * 255).astype(np.uint8)).resize((SIZE, SIZE), Image.BICUBIC), float)
        # Bicubic resize does not wrap; blend the seam by averaging with a rolled copy.
        big = (big + np.roll(big, SIZE // (cells * 2), (0, 1))) / 2
        total += big / 255 * amplitude
        amplitude *= falloff
    total -= total.min()
    return total / total.max()


def tiles(count, grout_px, colour, grout, spread, bevel_px, tile_rough, hue_spread=0.0):
    cell = SIZE // count
    y, x = np.mgrid[0:SIZE, 0:SIZE]
    fx, fz = x % cell, y % cell
    # Distance in pixels to the nearest joint centre line.
    edge = np.minimum(np.minimum(fx, cell - 1 - fx), np.minimum(fz, cell - 1 - fz)).astype(float)
    in_tile = np.clip((edge - grout_px / 2 + 0.5), 0, 1)
    ids = (y // cell) * count + (x // cell)
    shade = (rng.random(count * count) - 0.5)[ids] * spread
    hue = (rng.random(count * count) - 0.5)[ids] * hue_spread
    glaze = (periodic_noise(3) - 0.5) * 0.02
    rgb = np.empty((SIZE, SIZE, 3))
    for c in range(3):
        tint = 1 + shade + glaze + hue * (-1, 0.2, 1)[c]
        rgb[..., c] = grout[c] + (colour[c] * tint - grout[c]) * in_tile
    # Height: flat glazed face, rounded shoulder, recessed joint.
    shoulder = np.clip((edge - grout_px / 2) / bevel_px, 0, 1)
    height = shoulder * shoulder * (3 - 2 * shoulder) + (periodic_noise(2) - 0.5) * 0.05 * in_tile
    # Each tile is set at a very slight tilt, which is what breaks up reflections on a real wall.
    tilt_x = (rng.random(count * count) - 0.5)[ids]
    tilt_z = (rng.random(count * count) - 0.5)[ids]
    height += ((fx / cell - 0.5) * tilt_x + (fz / cell - 0.5) * tilt_z) * 0.35 * in_tile
    strength = 2.2
    dx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * strength
    dy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * strength
    normal = np.dstack([-dx, dy, np.ones_like(dx)])
    normal /= np.linalg.norm(normal, axis=2, keepdims=True)
    rough = 0.9 + (tile_rough + (periodic_noise(3) - 0.5) * 0.08 - 0.9) * in_tile
    return rgb, normal, rough


def save(name, rgb, normal, rough):
    folder = os.path.join(ROOT, "public/assets/surfaces")
    as_image = lambda a: Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8))
    as_image(rgb).save(os.path.join(folder, f"{name}_diff.webp"), quality=92, method=6)
    as_image(normal * 0.5 + 0.5).save(os.path.join(folder, f"{name}_nor.webp"), quality=95, method=6)
    as_image(np.dstack([rough] * 3)).save(os.path.join(folder, f"{name}_rough.webp"), quality=90, method=6)


# 4 x 4 square tiles per repeat. One repeat spans 1.2 m in the game, so a tile is 30 cm.
save("pool-tile", *tiles(4, 5, (0.95, 0.96, 0.95), (0.74, 0.78, 0.77), 0.035, 7, 0.16))
# 8 x 8 mosaic per repeat, 15 cm tiles in mixed blues.
save("pool-mosaic", *tiles(8, 5, (0.55, 0.86, 0.9), (0.8, 0.9, 0.9), 0.16, 5, 0.22, hue_spread=0.1))
