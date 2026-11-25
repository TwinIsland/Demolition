"""Shared helpers for drawing 64x64 Minecraft-layout skins with a matching glow map."""
import random
from PIL import Image

# name: (u, v, width, height, depth) of the unfolded box
PARTS = {
    "head": (0, 0, 8, 8, 8), "hat": (32, 0, 8, 8, 8),
    "body": (16, 16, 8, 12, 4), "jacket": (16, 32, 8, 12, 4),
    "rarm": (40, 16, 4, 12, 4), "rsleeve": (40, 32, 4, 12, 4),
    "larm": (32, 48, 4, 12, 4), "lsleeve": (48, 48, 4, 12, 4),
    "rleg": (0, 16, 4, 12, 4), "rpants": (0, 32, 4, 12, 4),
    "lleg": (16, 48, 4, 12, 4), "lpants": (0, 48, 4, 12, 4),
}
SIDES = ("right", "front", "left", "back")


def face(part, side):
    u, v, w, h, d = PARTS[part]
    return {
        "top": (u + d, v, w, d), "bottom": (u + d + w, v, w, d),
        "right": (u, v + d, d, h), "front": (u + d, v + d, w, h),
        "left": (u + d + w, v + d, d, h), "back": (u + d + w + d, v + d, w, h),
    }[side]


class Skin:
    def __init__(self, seed):
        self.image = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
        self.glow = Image.new("RGBA", (64, 64), (0, 0, 0, 255))
        self.random = random.Random(seed)

    def shade(self, color, spread=9):
        k = self.random.randint(-spread, spread)
        return tuple(max(0, min(255, c + k)) for c in color) + (255,)

    def put(self, part, side, x, y, color, spread=5, glow=None):
        u, v, w, h = face(part, side)
        if 0 <= x < w and 0 <= y < h:
            self.image.putpixel((u + x, v + y), self.shade(color, spread))
            self.glow.putpixel((u + x, v + y), (glow or (0, 0, 0)) + (255,))

    def fill(self, part, color, sides=SIDES + ("top", "bottom"), rows=None, spread=9):
        for side in sides:
            _, _, w, h = face(part, side)
            for y in range(h):
                if rows and side in SIDES and not rows[0] <= y < rows[1]:
                    continue
                for x in range(w):
                    self.put(part, side, x, y, color, spread)

    def ring(self, part, y, color, chance=1.0, spread=6, glow=None):
        """One row around all four sides, optionally broken up."""
        for side in SIDES:
            for x in range(face(part, side)[2]):
                if self.random.random() < chance:
                    self.put(part, side, x, y, color, spread, glow)

    def rect(self, part, side, x0, y0, x1, y1, color, spread=6):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.put(part, side, x, y, color, spread)

    def camo(self, part, palette, sides=SIDES + ("top", "bottom"), rows=None):
        """Fill with a random mix of the palette for a mottled pattern."""
        for side in sides:
            _, _, w, h = face(part, side)
            for y in range(h):
                if rows and side in SIDES and not rows[0] <= y < rows[1]:
                    continue
                for x in range(w):
                    self.put(part, side, x, y, self.random.choice(palette), 5)

    def save(self, path, glow=True):
        self.image.save(f"{path}.png")
        if glow:
            self.glow.convert("RGB").save(f"{path}-glow.png")


