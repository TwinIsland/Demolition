"""Renders skins as posed 3D figures into one contact sheet, without starting the game.

    python3 tools/skin-forge/preview.py out.png skin.png [skin.png ...]

Each skin is shown twice: from the front-right and from the back-left.
"""
import math
import sys

from PIL import Image, ImageDraw

from kit import PARTS

# part: (min corner x, y, z) with the character facing +z and their right at -x
BOXES = {
    "head": (-4, 24, -4), "body": (-4, 12, -2),
    "rarm": (-8, 12, -2), "larm": (4, 12, -2), "rleg": (-4, 0, -2), "lleg": (0, 0, -2),
}
OVERLAY = {"hat": ("head", 0.5), "jacket": ("body", 0.25), "rsleeve": ("rarm", 0.25), "lsleeve": ("larm", 0.25), "rpants": ("rleg", 0.25), "lpants": ("lleg", 0.25)}
LIGHT = {"top": 1.0, "front": 0.92, "left": 0.78, "right": 0.78, "back": 0.7, "bottom": 0.55}


def quads(skin):
    """Yields (corners, colour) for every opaque texel of every box face."""
    k = skin.width // 64
    for part, (u, v, w, h, d) in PARTS.items():
        base, grow = OVERLAY.get(part, (part, 0))
        x0, y0, z0 = BOXES[base]
        sx, sy, sz = (w + 2 * grow) / w, (h + 2 * grow) / h, (d + 2 * grow) / d
        x0, y0, z0 = x0 - grow, y0 - grow, z0 - grow
        W, H, D = w * sx, h * sy, d * sz
        faces = {
            "front": (u + d, v + d, w, h, lambda i, j: (x0 + i * sx, y0 + H - j * sy, z0 + D), (sx, 0, 0), (0, -sy, 0)),
            "back": (u + 2 * d + w, v + d, w, h, lambda i, j: (x0 + W - i * sx, y0 + H - j * sy, z0), (-sx, 0, 0), (0, -sy, 0)),
            "right": (u, v + d, d, h, lambda i, j: (x0, y0 + H - j * sy, z0 + i * sz), (0, 0, sz), (0, -sy, 0)),
            "left": (u + d + w, v + d, d, h, lambda i, j: (x0 + W, y0 + H - j * sy, z0 + D - i * sz), (0, 0, -sz), (0, -sy, 0)),
            "top": (u + d, v, w, d, lambda i, j: (x0 + i * sx, y0 + H, z0 + j * sz), (sx, 0, 0), (0, 0, sz)),
            "bottom": (u + d + w, v, w, d, lambda i, j: (x0 + i * sx, y0, z0 + j * sz), (sx, 0, 0), (0, 0, sz)),
        }
        for side, (fu, fv, fw, fh, at, di, dj) in faces.items():
            for j in range(fh * k):
                for i in range(fw * k):
                    r, g, b, a = skin.getpixel((fu * k + i, fv * k + j))
                    if a < 128:
                        continue
                    p = at(i / k, j / k)
                    a1 = tuple(c / k for c in di)
                    b1 = tuple(c / k for c in dj)
                    corners = [p, add(p, a1), add(add(p, a1), b1), add(p, b1)]
                    yield corners, tuple(int(c * LIGHT[side]) for c in (r, g, b))


def add(p, q):
    return (p[0] + q[0], p[1] + q[1], p[2] + q[2])


def render(skin, yaw, scale=14, pitch=14):
    cy, sy_ = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
    cp, sp = math.cos(math.radians(pitch)), math.sin(math.radians(pitch))

    def project(p):
        x = p[0] * cy + p[2] * sy_
        z = -p[0] * sy_ + p[2] * cy
        y = (p[1] - 16) * cp - z * sp
        depth = (p[1] - 16) * sp + z * cp
        return x, y, depth

    image = Image.new("RGBA", (24 * scale, 40 * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    polygons = []
    for corners, color in quads(skin):
        points = [project(c) for c in corners]
        polygons.append((sum(p[2] for p in points) / 4, [(12 * scale + p[0] * scale, 20 * scale - p[1] * scale) for p in points], color))
    for _, points, color in sorted(polygons, key=lambda q: q[0]):
        draw.polygon(points, fill=color + (255,))
    return image


if __name__ == "__main__":
    out, paths = sys.argv[1], sys.argv[2:]
    cell = render(Image.new("RGBA", (64, 64)), 0).size
    sheet = Image.new("RGB", (cell[0] * 2 * len(paths), cell[1]), (58, 62, 70))
    for index, path in enumerate(paths):
        skin = Image.open(path).convert("RGBA")
        for view, yaw in enumerate((-32, 148)):
            figure = render(skin, yaw)
            sheet.paste(figure, ((index * 2 + view) * cell[0], 0), figure)
    sheet.save(out)
