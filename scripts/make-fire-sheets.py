#!/usr/bin/env python3
"""Packs the ground-fire textures from Unity's CC0 "VFX Image Sequences & Flipbooks".

Source sheets (CC0, https://unity.com/blog/engine-platform/free-vfx-image-sequences-flipbooks),
fetched here from the ezEngine content mirror:

    https://raw.githubusercontent.com/ezEngine/content/main/ParticleFX/Unity/SmallFlame01_16x4.png
    https://raw.githubusercontent.com/ezEngine/content/main/ParticleFX/Unity/WispySmoke03_8x8.png

Outputs, in public/assets/effects/:

    fire-flames.webp  16 x 4 frames of flame, colour with alpha, unchanged apart from the encoding
    fire-smoke.webp   8 x 8 frames of smoke: R shade, G coverage; B is tileable fbm noise over the
                      whole sheet, which the burning floor scrolls

    python3 scripts/make-fire-sheets.py <SmallFlame01_16x4.png> <WispySmoke03_8x8.png>
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

out = Path(__file__).resolve().parent.parent / "public/assets/effects"


def fbm(size, octaves, seed, base):
    """Tileable value-noise fbm in 0..1."""
    r = np.random.default_rng(seed)
    total, amp, norm = np.zeros((size, size), np.float32), 1.0, 0.0
    for o in range(octaves):
        n = base * 2**o
        lattice = r.random((n, n), dtype=np.float32)
        at = np.arange(size) * n / size
        i, f = at.astype(int), at - at.astype(int)
        f = f * f * (3 - 2 * f)
        j = (i + 1) % n
        a = lattice[np.ix_(i, i)] * (1 - f) + lattice[np.ix_(i, j)] * f
        b = lattice[np.ix_(j, i)] * (1 - f) + lattice[np.ix_(j, j)] * f
        total += amp * (a * (1 - f[:, None]) + b * f[:, None])
        norm += amp
        amp *= 0.5
    return total / norm


flames = Image.open(sys.argv[1]).convert("RGBA")
assert flames.size == (2048, 1024), flames.size
flames.save(out / "fire-flames.webp", quality=90, method=6, exact=True)

smoke = np.asarray(Image.open(sys.argv[2]).convert("LA"))
assert smoke.shape[:2] == (1024, 1024), smoke.shape
packed = np.dstack([smoke[..., 0], smoke[..., 1], (fbm(1024, 6, 11, 8) * 255).astype(np.uint8)])
Image.fromarray(packed, "RGB").save(out / "fire-smoke.webp", quality=88, method=6)
for name in ("fire-flames.webp", "fire-smoke.webp"):
    print(name, (out / name).stat().st_size // 1024, "KB")
