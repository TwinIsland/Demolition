"""Draws the story-mode cast as Minecraft-layout skins.

Run from the project root:  python3 tools/skin-forge/story.py
Writes src/story/assets/skins/<id>.png. These are story-only textures, loaded by path: they are
not skin packs, so none of them shows up in the lobby picker.
"""
import os

from PIL import Image

from kit import SIDES, Skin, face

OUT = "src/story/assets/skins"
ALL = SIDES + ("top", "bottom")
LIMBS = ("rarm", "larm", "rleg", "lleg")
BASE = ("head", "body") + LIMBS
# Columns of a side face run back to front on the character's right and front to back on the left.
BACK_HALF = {"right": (0, 3), "left": (4, 7)}


class Flat(Skin):
    """No per-pixel noise, for characters that are meant to look like sprites."""

    def shade(self, color, spread=0):
        return tuple(color) + (255,)


def pixels(s, part, side, rows, color, spread=3, y0=0):
    """Paints from a small bitmap: one string per row, any non-space character is a pixel."""
    for y, row in enumerate(rows):
        for x, mark in enumerate(row):
            if mark != " ":
                s.put(part, side, x, y0 + y, color, spread)


def zero():
    """Zero: messy black hair over one eye, open black hoodie, bandaged right forearm."""
    s = Skin(11)
    tone, lip = (238, 214, 200), (190, 140, 132)
    hair, strand = (22, 21, 26), (50, 48, 58)
    hood, rib, tee, pants = (26, 26, 30), (46, 46, 52), (62, 62, 66), (30, 30, 35)
    silver, wrap, wrap_line = (188, 190, 198), (234, 229, 218), (198, 190, 174)
    for part in BASE:
        s.fill(part, tone, spread=4)

    # Hair, with the face showing only on his right (the viewer's left).
    s.fill("head", hair, sides=("top", "back"), spread=4)
    for side in ("left", "right"):
        s.rect("head", side, 0, 0, 7, 5, hair, 4)
        s.rect("head", side, BACK_HALF[side][0], 6, BACK_HALF[side][1], 7, hair, 4)
    pixels(s, "head", "front", ["########", "########", "#   ####", "    ####", "    ####", "     ###", "      ##", "       #"], hair)
    pixels(s, "head", "front", [" ## "], (206, 176, 164), y0=3)
    s.put("head", "front", 1, 4, (236, 236, 232), 2)
    s.put("head", "front", 2, 4, (58, 58, 70), 2)
    pixels(s, "head", "front", [" ## "], lip, y0=6)
    s.fill("hat", hair, sides=("top",), spread=4)
    pixels(s, "hat", "front", ["########", "## #####", "#   ####", "    ####", "    ####", "     ###", "      ##", "       #"], hair)
    for side in ("left", "right", "back"):
        s.rect("hat", side, 0, 0, 7, 5, hair, 4)
        s.ring("hat", 6, hair, 0.0)
        for x in range(8):
            if x % 2 == (side == "back"):
                s.put("hat", side, x, 6, hair, 4)
            if x % 3 == 1:
                s.put("hat", side, x, 7, hair, 4)
    for side, x, y in (("top", 2, 2), ("top", 5, 4), ("top", 3, 6), ("front", 5, 1), ("front", 6, 3), ("left", 2, 2), ("right", 5, 3), ("back", 2, 2), ("back", 5, 4)):
        s.put("hat", side, x, y, strand, 3)

    # Dark tee and chain under an open hoodie whose hem hangs over the hips.
    s.fill("body", hood)
    s.rect("body", "front", 2, 0, 5, 11, tee)
    s.rect("body", "front", 3, 0, 4, 0, tone, 3)
    pixels(s, "body", "front", ["  #  #  ", "   ##   "], silver, y0=1)
    s.fill("jacket", hood, sides=("left", "right", "back", "top"))
    for x in (0, 7):
        s.rect("jacket", "front", x, 0, x, 11, hood)
    for x in (1, 6):
        s.rect("jacket", "front", x, 0, x, 11, (88, 88, 96), 4)
    s.rect("jacket", "back", 1, 0, 6, 3, rib)
    s.rect("jacket", "back", 2, 1, 5, 2, hood)
    for pant in ("rpants", "lpants"):
        s.ring(pant, 0, hood)
        s.ring(pant, 1, rib)

    # Sleeves pushed up to the elbow; the right forearm is wrapped down to the palm.
    for arm, sleeve in (("rarm", "rsleeve"), ("larm", "lsleeve")):
        s.fill(arm, hood, sides=SIDES, rows=(0, 7))
        s.fill(arm, hood, sides=("top",))
        s.fill(sleeve, hood, sides=SIDES, rows=(0, 7))
        s.fill(sleeve, hood, sides=("top",))
        s.ring(sleeve, 6, rib)
    s.fill("rarm", wrap, sides=SIDES, rows=(7, 11), spread=4)
    for y, offset in ((8, 0), (10, 2)):
        for side in SIDES:
            for x in range(4):
                if (x + offset) % 4 < 2:
                    s.put("rarm", side, x, y, wrap_line, 3)
    s.put("rarm", "front", 1, 11, wrap, 3)
    s.put("rarm", "back", 2, 11, wrap, 3)

    # Black jeans, worn canvas sneakers with a pale toe cap and sole.
    for leg in ("rleg", "lleg"):
        s.fill(leg, pants, sides=SIDES + ("top",), rows=(0, 10))
        s.ring(leg, 10, (44, 44, 50))
        s.rect(leg, "front", 0, 10, 3, 10, (212, 208, 198), 5)
        s.ring(leg, 11, (204, 198, 186), spread=8)
        s.fill(leg, (150, 146, 138), sides=("bottom",))
    return s


def lulu():
    """Lulu: tutorial sprite in flat colours. Blonde twin tails, red bow, white dress with red trim."""
    s = Flat(12)
    tone, blush = (255, 226, 200), (255, 172, 170)
    hair, hair_dark = (250, 206, 90), (222, 160, 56)
    red, red_dark, white, cream = (224, 52, 60), (168, 32, 44), (250, 248, 242), (228, 224, 214)
    eye, eye_dark, ink = (64, 168, 120), (30, 96, 70), (70, 44, 52)
    for part in BASE:
        s.fill(part, tone)

    s.fill("head", hair, sides=("top", "back"))
    s.rect("head", "back", 0, 7, 7, 7, hair_dark)
    for side in ("left", "right"):
        s.rect("head", side, 0, 0, 7, 4, hair)
        s.rect("head", side, BACK_HALF[side][0], 5, BACK_HALF[side][1], 7, hair)
    pixels(s, "head", "front", ["########", "########", "## ## ##", "#      #"], hair)
    pixels(s, "head", "front", [" ##  ## "], ink, y0=3)
    pixels(s, "head", "front", [" #    # "], white, y0=4)
    pixels(s, "head", "front", ["  #  #  "], eye, y0=4)
    pixels(s, "head", "front", ["  #  #  "], eye_dark, y0=5)
    pixels(s, "head", "front", [" #    # "], blush, y0=5)
    pixels(s, "head", "front", ["   ##   "], (200, 92, 96), y0=6)

    # Bow on the crown, tails tied at the sides and hanging down the outside of the arms.
    pixels(s, "hat", "top", [" ##  ## ", " ###### ", " ##  ## "], red, y0=4)
    pixels(s, "hat", "top", ["   ##   "], red_dark, y0=5)
    pixels(s, "hat", "front", [" ##  ## "], red)
    for side, sleeve in (("right", "rsleeve"), ("left", "lsleeve")):
        x0 = 1 if side == "right" else 3
        s.rect("hat", side, x0, 2, x0 + 3, 7, hair)
        s.rect("hat", side, x0, 2, x0 + 3, 3, red)
        s.rect("hat", side, x0 + 1, 6, x0 + 2, 7, hair_dark)
        s.rect(sleeve, side, 1, 0, 2, 6, hair)
        s.rect(sleeve, side, 1, 5, 1, 7, hair_dark)

    # Dress: sailor collar, ribbon, belt, a skirt that flares over the legs.
    s.fill("body", white)
    pixels(s, "body", "front", ["###  ###", " ##  ## "], red)
    for side in ("left", "right", "back"):
        s.rect("body", side, 0, 0, 7, 1, red)
    pixels(s, "body", "front", ["   ##   "], red, y0=2)
    pixels(s, "body", "front", ["   ##   "], red_dark, y0=3)
    s.ring("body", 7, red)
    s.ring("body", 11, cream)
    for arm, sleeve in (("rarm", "rsleeve"), ("larm", "lsleeve")):
        s.fill(arm, white, sides=SIDES + ("top",), rows=(0, 4))
        s.ring(arm, 3, red)
    for leg, pant in (("rleg", "rpants"), ("lleg", "lpants")):
        s.fill(leg, white, sides=SIDES + ("top",), rows=(0, 4))
        s.fill(pant, white, sides=SIDES, rows=(0, 4))
        s.ring(pant, 3, red)
        s.fill(leg, cream, sides=SIDES, rows=(4, 8))
        s.fill(leg, red, sides=SIDES, rows=(8, 12))
        s.ring(leg, 11, red_dark)
        s.fill(leg, red_dark, sides=("bottom",))
    return s


FONT = {
    "S": ("###", "#  ", "###", "  #", "###"), "A": ("###", "# #", "###", "# #", "# #"),
    "M": ("# #", "###", "###", "# #", "# #"), "P": ("###", "# #", "###", "#  ", "#  "),
    "L": ("#  ", "#  ", "#  ", "#  ", "###"), "E": ("###", "#  ", "###", "#  ", "###"),
}


def zhang_san():
    """Zhang San: an unfinished grey template, checkerboard torso under a SAMPLE label.

    Drawn at 64 and doubled to 128 so the label has room for its letters.
    """
    s = Flat(13)
    grey, joint, dark = (158, 158, 162), (126, 126, 130), (72, 72, 76)
    for part in BASE:
        s.fill(part, grey)
    s.fill("head", (176, 176, 180), sides=("top",))
    pixels(s, "head", "front", ["  #  #  "], dark, y0=4)
    pixels(s, "head", "front", ["  ####  "], dark, y0=6)
    for side in ALL:
        _, _, w, h = face("body", side)
        for y in range(h):
            for x in range(w):
                s.put("body", side, x, y, (206, 206, 210) if (x + y) % 2 else (236, 236, 240))
    for limb in LIMBS:
        s.ring(limb, 5, joint)
        s.ring(limb, 11, joint)
    image = s.image.resize((128, 128), Image.NEAREST)
    for u, v in ((40, 40), (64, 40)):  # chest and back, in 128 coordinates
        for y in range(4, 20):
            for x in range(1, 15):
                edge = x in (1, 14) or y in (4, 19)
                image.putpixel((u + x, v + y), (60, 60, 64, 255) if edge else (250, 250, 250, 255))
        for line, word in enumerate(("SAM", "PLE")):
            for index, letter in enumerate(word):
                for y, row in enumerate(FONT[letter]):
                    for x, mark in enumerate(row):
                        if mark == "#":
                            image.putpixel((u + 3 + index * 4 + x, v + 6 + line * 7 + y), (204, 44, 48, 255))
    s.image = image
    return s


def blue_screen():
    """Heavenly King 1, Blue Screen: a monitor for a head showing a sad face, error text down the body."""
    s = Skin(14)
    blue, white, bezel = (20, 92, 200), (240, 244, 250), (46, 46, 52)
    for part in BASE:
        s.fill(part, blue, spread=4)
    pixels(s, "head", "front", ["  #  #  ", "        ", "   ##   ", "  #  #  "], white, y0=3)
    s.fill("hat", bezel, sides=("top", "left", "right", "back"))
    pixels(s, "hat", "front", ["########", "#      #", "#      #", "#      #", "#      #", "#      #", "#      #", "########"], bezel)
    s.put("hat", "front", 6, 7, (90, 220, 110), 2)
    text = [" ###### ", "        ", " ####   ", "        ", " #####  ", "        ", " ###    ", "        ", " ##  ## ", " #   ## "]
    pixels(s, "body", "front", text, white, y0=1)
    pixels(s, "body", "back", text[:7], white, y0=1)
    for limb in LIMBS:
        for y in (2, 5, 8):
            s.ring(limb, y, white, chance=0.3)
        s.ring(limb, 11, (12, 60, 140))
    return s


def popup():
    """Heavenly King 2, Popup: a window for a head with a close button, a shouting advert for a body."""
    s = Skin(15)
    chrome, navy, red, yellow, white = (214, 214, 220), (30, 60, 150), (226, 40, 40), (250, 210, 40), (250, 250, 250)
    for part in BASE:
        s.fill(part, chrome, spread=4)
    for y in (0, 1):
        s.ring("head", y, navy)
    s.fill("head", navy, sides=("top",))
    s.rect("head", "front", 6, 0, 7, 1, red, 3)
    s.put("head", "front", 6, 0, white, 2)
    s.put("head", "front", 7, 1, white, 2)
    pixels(s, "head", "front", ["  #  #  ", " #    # ", "  ####  "], (40, 40, 48), y0=4)
    s.fill("body", yellow)
    for side in ("front", "back"):
        s.rect("body", side, 1, 1, 6, 6, red)
        pixels(s, "body", side, ["  #  #  ", "  #  #  ", "        ", "  #  #  "], white, y0=2)
    s.rect("body", "front", 2, 8, 5, 9, (60, 180, 80))
    for arm in ("rarm", "larm"):
        for y in range(9):
            s.ring(arm, y, red if y // 2 % 2 else yellow)
        s.fill(arm, yellow, sides=("top",))
        s.fill(arm, white, sides=SIDES + ("bottom",), rows=(9, 12), spread=3)
    for leg in ("rleg", "lleg"):
        s.fill(leg, navy, sides=SIDES + ("top",), rows=(0, 10))
        s.fill(leg, (90, 90, 98), sides=SIDES + ("bottom",), rows=(10, 12))
    return s


def antivirus():
    """Heavenly King 3, Antivirus: white clean suit, green guard vest with a shield, scanning visor."""
    s = Skin(16)
    white, green, deep, visor = (232, 236, 232), (38, 170, 96), (22, 104, 60), (20, 34, 30)
    for part in BASE:
        s.fill(part, white, spread=4)
    s.rect("head", "front", 1, 3, 6, 5, visor, 3)
    pixels(s, "head", "front", ["  #  #  "], (110, 250, 150), y0=4)
    for side in ("left", "right"):
        s.rect("head", side, 0, 3, 7, 5, visor, 3)
    for side in ("top", "back"):
        s.rect("head", side, 3, 0, 4, 7, green)
    for y in (0, 1):
        s.ring("hat", y, (210, 220, 214))
    s.fill("hat", (210, 220, 214), sides=("top",))
    s.rect("hat", "top", 3, 0, 4, 7, green)
    for side in ("front", "back"):
        s.rect("body", side, 1, 1, 6, 8, green)
    pixels(s, "body", "front", ["  ####  ", "  ####  ", "  ####  ", "   ##   "], white, y0=2)
    pixels(s, "body", "front", ["   ##   "], green, y0=3)
    s.ring("body", 10, visor)
    for arm, sleeve in (("rarm", "rsleeve"), ("larm", "lsleeve")):
        s.fill(sleeve, green, sides=SIDES + ("top",), rows=(0, 3))
        s.fill(arm, green, sides=SIDES + ("bottom",), rows=(9, 12))
    for leg in ("rleg", "lleg"):
        s.rect(leg, "front", 0, 4, 3, 5, green)
        s.fill(leg, deep, sides=SIDES + ("bottom",), rows=(9, 12))
    return s


CAST = {"zero": zero, "lulu": lulu, "zhang-san": zhang_san, "blue-screen": blue_screen, "popup": popup, "antivirus": antivirus}

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for name, draw in CAST.items():
        draw().save(f"{OUT}/{name}", glow=False)
