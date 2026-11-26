#!/usr/bin/env python3
"""Bakes public/assets/effects/fire-flipbook.webp, the looping flame sheet of the ground fire.

A small 2D smoke solver (semi-Lagrangian advection, buoyancy, vorticity confinement, spectral
pressure projection) burns a strip of fuel along the bottom edge. 8 x 8 frames, 128 px each:

  R  heat      what is burning right now; the shader maps it through a blackbody-like ramp
  G  soot      the smoke the flame leaves behind above its tips
  B  noise     tileable fbm over the whole sheet, unrelated to the frames; the shader scrolls it
               for the burning floor and to break up the flame edges

The last frames are cross-faded into the first so the sheet loops without a pop.

    python3 scripts/make-fire-flipbook.py
"""
from pathlib import Path

import numpy as np
from PIL import Image

W, H = 128, 192  # solver grid; frames are stored square, the billboard stretches them back
GRID, FRAME = 8, 128
FRAMES = GRID * GRID
BLEND = 14  # frames cross-faded to close the loop
WARMUP = 90
SUBSTEPS = 3
DT = 0.55

rng = np.random.default_rng(7)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)  # y grows upward: row 0 is the ground


def sample(field, x, y):
    """Bilinear lookup, clamped at the borders."""
    x = np.clip(x, 0, W - 1.001)
    y = np.clip(y, 0, H - 1.001)
    x0, y0 = x.astype(np.int32), y.astype(np.int32)
    fx, fy = x - x0, y - y0
    a = field[y0, x0] * (1 - fx) + field[y0, x0 + 1] * fx
    b = field[y0 + 1, x0] * (1 - fx) + field[y0 + 1, x0 + 1] * fx
    return a * (1 - fy) + b * fy


def advect(field, u, v):
    return sample(field, xx - DT * u, yy - DT * v)


kx = np.fft.fftfreq(W)[None, :] * 2 * np.pi
ky = np.fft.fftfreq(H)[:, None] * 2 * np.pi
k2 = kx * kx + ky * ky
k2[0, 0] = 1


def project(u, v):
    """Removes divergence in Fourier space. Periodic, which the edge damping below hides."""
    fu, fv = np.fft.fft2(u), np.fft.fft2(v)
    div = (kx * fu + ky * fv) / k2
    return np.real(np.fft.ifft2(fu - kx * div)).astype(np.float32), np.real(
        np.fft.ifft2(fv - ky * div)
    ).astype(np.float32)


def confine(u, v, strength):
    """Vorticity confinement: puts back the curl that advection smears away."""
    curl = np.gradient(v, axis=1) - np.gradient(u, axis=0)
    mag = np.abs(curl)
    gy, gx = np.gradient(mag)
    norm = np.sqrt(gx * gx + gy * gy) + 1e-5
    return u + DT * strength * (gy / norm) * curl, v - DT * strength * (gx / norm) * curl


def fbm(shape, octaves, seed, base=4):
    """Tileable value-noise fbm in 0..1."""
    r = np.random.default_rng(seed)
    out = np.zeros(shape, np.float32)
    amp, total = 1.0, 0.0
    for o in range(octaves):
        n = base * 2**o
        lattice = r.random((n, n), dtype=np.float32)
        ys = np.arange(shape[0]) * n / shape[0]
        xs = np.arange(shape[1]) * n / shape[1]
        y0, x0 = ys.astype(int), xs.astype(int)
        fy, fx = ys - y0, xs - x0
        fy, fx = fy * fy * (3 - 2 * fy), fx * fx * (3 - 2 * fx)
        y1, x1 = (y0 + 1) % n, (x0 + 1) % n
        a = lattice[np.ix_(y0, x0)] * (1 - fx) + lattice[np.ix_(y0, x1)] * fx
        b = lattice[np.ix_(y1, x0)] * (1 - fx) + lattice[np.ix_(y1, x1)] * fx
        out += amp * (a * (1 - fy[:, None]) + b * fy[:, None])
        total += amp
        amp *= 0.5
    return out / total


# Fuel: a low mound in the middle of the bottom edge. Its strength flickers along x over time.
centre = (xx - W / 2) / (W * 0.27)
mound = np.exp(-(centre**4)) * np.clip(1 - (yy - 3) / 10.0, 0, 1) * (yy >= 3)
flicker = fbm((512, W), 3, 3, base=8)  # rows are time, tiling so the source loops too

# Fields fade out before they can wrap around the periodic solver.
side = np.clip(np.minimum(xx, W - 1 - xx) / 14.0, 0, 1)
top = np.clip((H - 1 - yy) / 26.0, 0, 1)
fade = (side * top).astype(np.float32)

u = np.zeros((H, W), np.float32)
v = np.zeros((H, W), np.float32)
heat = np.zeros((H, W), np.float32)
soot = np.zeros((H, W), np.float32)
frames = []
step = 0
for frame in range(WARMUP + FRAMES + BLEND):
    for _ in range(SUBSTEPS):
        row = flicker[(step * 3) % 512]
        source = mound * np.clip(2.6 * row[None, :] - 0.55, 0, 1.3)
        heat = np.maximum(heat, np.clip(source * 1.5, 0, 1))
        # Hot gas rises; a little sideways turbulence at the base makes the tongues split.
        v += DT * (0.7 * heat - 0.03 * soot)
        u += DT * 0.5 * mound * (rng.random((H, W), dtype=np.float32) - 0.5)
        u, v = confine(u, v, 0.22)
        u, v = project(u, v)
        u, v = advect(u, u, v), advect(v, u, v)
        burnt = heat
        heat = advect(heat, u, v)
        # Radiative cooling: hot gas loses heat fast, so the tips thin out instead of fading evenly.
        heat = np.clip(heat - DT * (0.0085 + 0.012 * heat * heat), 0, 1) * fade
        soot = advect(soot, u, v) * 0.985 + 0.05 * np.clip(burnt - heat, 0, 1) * (heat < 0.4)
        soot = np.clip(soot, 0, 1) * fade
        u *= fade * 0.992
        v *= fade * 0.992
        step += 1
    if frame >= WARMUP:
        frames.append((heat.copy(), soot.copy()))

for i in range(BLEND):  # close the loop
    t = (i + 0.5) / BLEND
    frames[i] = tuple(a * t + b * (1 - t) for a, b in zip(frames[i], frames[FRAMES + i]))
frames = frames[:FRAMES]

sheet = np.zeros((GRID * FRAME, GRID * FRAME, 3), np.float32)
for i, (h, s) in enumerate(frames):
    cell = np.stack([np.clip(h * 1.15, 0, 1) ** 0.8, np.clip(s * 1.6, 0, 1)], -1)[::-1]  # top row first
    image = Image.fromarray((cell * 255).astype(np.uint8)).resize((FRAME, FRAME), Image.LANCZOS)
    r, c = divmod(i, GRID)
    sheet[r * FRAME : (r + 1) * FRAME, c * FRAME : (c + 1) * FRAME, :2] = np.asarray(image, np.float32)[..., :2] / 255
sheet[..., 2] = fbm((GRID * FRAME, GRID * FRAME), 6, 11, base=8)

out = Path(__file__).resolve().parent.parent / "public/assets/effects/fire-flipbook.webp"
Image.fromarray((np.clip(sheet, 0, 1) * 255).astype(np.uint8)).save(out, quality=88, method=6)
print(out, out.stat().st_size // 1024, "KB")
