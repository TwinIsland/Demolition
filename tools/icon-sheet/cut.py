"""Slices a generated 3x3 chroma-key icon sheet into trimmed 256 px transparent WebP icons.

usage: cut.py SHEET OUT_DIR green|magenta name1,name2,...   (names in reading order, "-" skips a cell)
needs numpy, scipy, Pillow
"""
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

src, out, key_name, names = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4].split(",")
im = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
h, w = im.shape[:2]
for k, name in enumerate(names):
    if name == "-":
        continue
    row, col = divmod(k, 3)
    c = im[row * h // 3 : (row + 1) * h // 3, col * w // 3 : (col + 1) * w // 3].copy()
    r, g, b = c[..., 0], c[..., 1], c[..., 2]
    key = g - np.maximum(r, b) if key_name == "green" else np.minimum(r, b) - g
    alpha = np.clip(1 - (key - 25) / 60, 0, 1)
    # White gutters some sheets draw between cells.
    wl, _ = ndi.label(ndi.binary_dilation(c.min(-1) > 200, iterations=2))
    edge = np.unique(np.concatenate([wl[0], wl[-1], wl[:, 0], wl[:, -1]]))
    alpha[np.isin(wl, edge[edge > 0])] = 0
    # Keep the icon and its close fragments; drop specks and gutter lines.
    solid = alpha > 0.5
    lab, n = ndi.label(ndi.binary_dilation(solid, iterations=6))
    sizes = ndi.sum(solid, lab, range(1, n + 1))
    alpha *= np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > 0.02 * sizes.max()])
    alpha = np.clip((ndi.gaussian_filter(alpha, 0.6) - 0.15) / 0.85, 0, 1)
    spill = np.clip(key, 0, None)
    if key_name == "green":
        g = g - spill
    else:
        r, b = r - spill, b - spill
    rgba = np.dstack([r, g, b, alpha * 255]).clip(0, 255).astype(np.uint8)
    ys, xs = np.where(alpha > 0.05)
    crop = Image.fromarray(rgba).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    side = int(max(crop.size) / 0.92)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(crop, ((side - crop.width) // 2, (side - crop.height) // 2))
    canvas.resize((256, 256), Image.LANCZOS).save(f"{out}/{name}.webp", quality=92, method=6)
    print(name, crop.size)
