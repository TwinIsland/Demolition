"""Builds Zero's Minecraft skin, the 8-bit walk sheet projected from it, and his dialogue portraits.

    python3 tools/story/make-zero.py [character-sheet.png] [skin.png]

With a skin given, that skin is used as it is (and copied to the assets) instead of the one
painted here, so the walk sheet always shows the same character as the 3D model.

Outputs go to src/story/assets: zero-skin.png (64 x 64 skin), zero-walk.png (4 facings x 4 frames
of 16 x 32, rows down / up / left / right) and zero-<mood>.png (40 x 40 portraits cut from the
head close-ups of the character sheet).
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[2] / "src" / "story" / "assets"

HAIR, HAIR_LIGHT = (21, 20, 26), (44, 42, 54)
SKIN, SKIN_SHADE = (240, 217, 207), (214, 186, 176)
EYE, EYE_WHITE, MOUTH = (92, 88, 100), (236, 234, 240), (170, 120, 118)
HOODIE, HOODIE_LIGHT, SHIRT = (27, 26, 32), (46, 44, 54), (74, 72, 80)
CHAIN, PANTS, PANTS_LIGHT = (201, 201, 210), (23, 22, 28), (38, 36, 46)
BANDAGE, BANDAGE_LINE = (233, 226, 214), (196, 187, 171)
SHOE, SOLE = (40, 40, 46), (216, 212, 204)


def skin() -> Image.Image:
    image = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    def box(x, y, w, h, color):
        draw.rectangle([x, y, x + w - 1, y + h - 1], fill=color)

    def dots(x, y, cells, color):
        for cx, cy in cells:
            image.putpixel((x + cx, y + cy), color + (255,))

    # Head: hair everywhere, then the face. The fringe hides the eye on the viewer's left.
    box(0, 0, 32, 16, HAIR)
    box(16, 0, 8, 8, SKIN_SHADE)  # underside
    dots(8, 0, [(1, 1), (5, 2), (3, 5), (6, 6), (2, 3)], HAIR_LIGHT)
    fx, fy = 8, 8
    box(fx + 4, fy + 3, 4, 1, SKIN)
    box(fx + 3, fy + 4, 5, 1, SKIN)
    box(fx + 2, fy + 5, 6, 1, SKIN)
    box(fx + 1, fy + 6, 6, 2, SKIN)
    dots(fx, fy, [(5, 4)], EYE_WHITE)
    dots(fx, fy, [(6, 4)], EYE)
    dots(fx, fy, [(4, 6), (5, 6)], MOUTH)
    dots(fx, fy, [(2, 1), (5, 0), (6, 2)], HAIR_LIGHT)
    for sx in (0, 16):  # sides: an ear's worth of skin below the hair, towards the face
        edge = sx + (5 if sx == 0 else 0)
        box(edge, 13, 3, 3, SKIN_SHADE)
        dots(sx, 8, [(2, 2), (5, 4)], HAIR_LIGHT)
    dots(24, 8, [(1, 2), (4, 4), (6, 1), (3, 6)], HAIR_LIGHT)

    # Body: open black hoodie over a grey shirt, a chain at the collar, the hood on the back.
    box(16, 16, 24, 16, HOODIE)
    bx, by = 20, 20
    box(bx + 3, by, 2, 12, SHIRT)
    box(bx + 2, by, 4, 1, SKIN)
    dots(bx, by, [(2, 1), (5, 1), (3, 2), (4, 2)], CHAIN)
    dots(bx, by, [(1, 2), (1, 3), (6, 2), (6, 3)], HOODIE_LIGHT)
    box(bx, by + 11, 8, 1, HOODIE_LIGHT)
    box(33, 20, 6, 4, HOODIE_LIGHT)
    box(34, 21, 4, 2, HOODIE)

    def arm(x, y, bandaged):
        box(x - 4, y - 4, 16, 16, HOODIE)
        box(x - 4, y + 6, 16, 6, BANDAGE if bandaged else SKIN)
        if bandaged:
            for row in (7, 9):
                box(x - 4, y + row, 16, 1, BANDAGE_LINE)
            box(x - 4, y + 10, 16, 2, SKIN)
        box(x - 4, y + 5, 16, 1, HOODIE_LIGHT)
        box(x + 4, y - 4, 4, 4, SKIN_SHADE)  # hand, seen from below

    arm(44, 20, True)
    arm(36, 52, False)

    def leg(x, y):
        box(x - 4, y - 4, 16, 16, PANTS)
        box(x - 4, y + 10, 16, 2, SHOE)
        box(x - 4, y + 11, 16, 1, SOLE)
        dots(x, y, [(1, 3), (2, 6)], PANTS_LIGHT)

    leg(4, 20)
    leg(20, 52)
    # Corners of the cross-shaped unwraps are unused.
    for x, y in ((0, 0), (24, 0), (0, 16), (12, 16), (36, 16), (40, 16), (52, 16), (16, 48), (28, 48), (32, 48), (44, 48)):
        w = 8 if y == 0 else 4
        draw.rectangle([x, y, x + w - 1, y + (7 if y == 0 else 3)], fill=(0, 0, 0, 0))
    return image


# Faces of the skin, as (x, y) of each 12-tall strip: front, back, outer side.
PARTS = {
    "right_arm": {"front": (44, 20), "back": (52, 20), "side": (40, 20)},
    "left_arm": {"front": (36, 52), "back": (44, 52), "side": (40, 52)},
    "right_leg": {"front": (4, 20), "back": (12, 20), "side": (0, 20)},
    "left_leg": {"front": (20, 52), "back": (28, 52), "side": (24, 52)},
}


def walk_sheet(texture: Image.Image) -> Image.Image:
    def cut(x, y, w, h):
        return texture.crop((x, y, x + w, y + h))

    def shade(part):
        return Image.eval(part, lambda v: v).point(lambda v: int(v * 0.7)) if part.mode != "RGBA" else Image.merge(
            "RGBA", [*(band.point(lambda v: int(v * 0.7)) for band in part.split()[:3]), part.split()[3]]
        )

    sheet = Image.new("RGBA", (16 * 4, 32 * 4), (0, 0, 0, 0))

    def paste(frame, part, x, y):
        frame.alpha_composite(part, (x, y))

    for row, facing in enumerate(("down", "up", "left", "right")):
        for step in range(4):
            frame = Image.new("RGBA", (16, 32), (0, 0, 0, 0))
            swing = (0, 1, 0, -1)[step]
            if facing in ("down", "up"):
                face = "front" if facing == "down" else "back"
                # Seen from behind, the character's left is on the viewer's left.
                near, far = ("right", "left") if facing == "down" else ("left", "right")
                body = cut(20, 20, 8, 12) if facing == "down" else cut(32, 20, 8, 12)
                head = cut(8, 8, 8, 8) if facing == "down" else cut(24, 8, 8, 8)
                for side, x, lift in ((near, 4, max(swing, 0)), (far, 8, max(-swing, 0))):
                    leg = cut(*PARTS[f"{side}_leg"][face], 4, 12)
                    paste(frame, leg.crop((0, lift, 4, 12)), x, 20)
                paste(frame, body, 4, 8)
                for side, x, lift in ((near, 0, max(-swing, 0)), (far, 12, max(swing, 0))):
                    paste(frame, cut(*PARTS[f"{side}_arm"][face], 4, 12), x, 8 - lift)
                paste(frame, head, 4, 0)
            else:
                side = "left" if facing == "left" else "right"
                other = "right" if side == "left" else "left"
                head = cut(16, 8, 8, 8) if side == "left" else cut(0, 8, 8, 8)
                body = cut(28, 20, 4, 12) if side == "left" else cut(16, 20, 4, 12)
                stride = swing * 2
                paste(frame, shade(cut(*PARTS[f"{other}_leg"]["side"], 4, 12)).crop((0, 0, 4, 12 - abs(swing))), 6 - stride, 20)
                paste(frame, shade(cut(*PARTS[f"{other}_arm"]["side"], 4, 12)), 6 + swing, 8)
                paste(frame, cut(*PARTS[f"{side}_leg"]["side"], 4, 12).crop((0, 0, 4, 12 - abs(swing))), 6 + stride, 20)
                paste(frame, body, 6, 8)
                paste(frame, cut(*PARTS[f"{side}_arm"]["side"], 4, 12), 6 - swing, 8)
                paste(frame, head, 4, 0)
            sheet.alpha_composite(frame, (step * 16, row * 32))
    return sheet


# Head close-ups on the bottom row of the character sheet, as fractions of its size.
MOODS = {"smug": (0.085, 0.63, 0.335), "flustered": (0.395, 0.63, 0.645), "sincere": (0.705, 0.63, 0.955)}
BACKDROP = (42, 36, 64)


def portraits(sheet_path: str):
    sheet = Image.open(sheet_path).convert("RGB")
    width, height = sheet.size
    for mood, (x0, y0, x1) in MOODS.items():
        size = int((x1 - x0) * width)
        crop = sheet.crop((int(x0 * width), int(y0 * height), int(x0 * width) + size, int(y0 * height) + size))
        for corner in ((0, 0), (size - 1, 0)):
            ImageDraw.floodfill(crop, corner, BACKDROP, thresh=40)
        small = crop.resize((40, 40), Image.BOX).quantize(24, dither=Image.Dither.NONE)
        small.convert("RGB").save(OUT / f"zero-{mood}.png")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    texture = Image.open(sys.argv[2]).convert("RGBA") if len(sys.argv) > 2 else skin()
    texture.save(OUT / "zero-skin.png")
    walk_sheet(texture).save(OUT / "zero-walk.png")
    if len(sys.argv) > 1 and sys.argv[1] != "-":
        portraits(sys.argv[1])
