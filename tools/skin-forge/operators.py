"""Draws the built-in operator skins.

Run from the project root:  python3 tools/skin-forge/operators.py
Every operator wears the same field kit (uniform, vest, boots, gloves) in a
role colour, with headgear that changes the silhouette.
"""
from kit import SIDES, Skin, face

OUT = "src/modules/skins"
BOOT, GLOVE, STRAP = (38, 36, 34), (44, 44, 42), (52, 48, 40)


def base(seed, tone, uniform, vest, hair=(46, 38, 30), eyes=(60, 84, 110)):
    s = Skin(seed)
    shadow = tuple(int(c * 0.82) for c in tone)
    for part in ("head", "body", "rarm", "larm", "rleg", "lleg"):
        s.fill(part, tone, spread=5)
    # Face
    s.fill("head", hair, sides=("top", "back"))
    for side in ("left", "right"):
        s.rect("head", side, 0, 0, 7, 2, hair)
        s.rect("head", side, 3 if side == "left" else 0, 3, 7 if side == "left" else 4, 5, hair)
    s.rect("head", "front", 0, 0, 7, 0, hair)
    for x in (0, 7):
        s.put("head", "front", x, 1, hair)
    for x in (1, 2, 5, 6):
        s.put("head", "front", x, 3, tuple(int(c * 0.6) for c in hair), 3)
    for x, color in ((1, (236, 236, 230)), (2, eyes), (5, eyes), (6, (236, 236, 230))):
        s.put("head", "front", x, 4, color, 2)
    for x in (3, 4):
        s.put("head", "front", x, 5, shadow, 3)
        s.put("head", "front", x, 6, tuple(int(c * 0.7) for c in tone), 3)
    # Uniform, vest, belt, gloves, boots
    s.fill("body", uniform)
    s.rect("body", "front", 1, 1, 6, 8, vest)
    s.rect("body", "back", 1, 1, 6, 8, vest)
    for side in ("left", "right"):
        s.rect("body", side, 0, 2, 3, 3, STRAP)
        s.rect("body", side, 0, 6, 3, 6, STRAP)
    for x in (1, 3, 5):
        s.rect("body", "front", x, 6, x, 7, tuple(int(c * 0.78) for c in vest))
    s.ring("body", 10, STRAP)
    s.put("body", "front", 3, 10, (160, 150, 110))
    for arm in ("rarm", "larm"):
        s.fill(arm, uniform, rows=(0, 9))
        s.fill(arm, uniform, sides=("top",))
        s.fill(arm, GLOVE, sides=SIDES + ("bottom",), rows=(9, 12))
    for leg in ("rleg", "lleg"):
        s.fill(leg, uniform, rows=(0, 9))
        s.fill(leg, BOOT, sides=SIDES + ("bottom",), rows=(9, 12))
        s.rect(leg, "front", 0, 4, 3, 5, tuple(int(c * 0.72) for c in uniform))
    return s


def helmet(s, color, rows=3, brim=None):
    s.fill("hat", color, sides=("top",))
    for side in SIDES:
        w = face("hat", side)[2]
        s.rect("hat", side, 0, 0, w - 1, (rows if side != "front" else rows - 1) - 1, color)
    if brim:
        s.ring("hat", rows - 1, brim)


def sapper():
    """Blast suit: high collar, heavy helmet with a dark visor, hazard chest band."""
    suit, plate = (78, 92, 62), (58, 68, 48)
    s = base(1, (214, 170, 132), suit, plate)
    helmet(s, suit, rows=8)
    s.rect("hat", "front", 1, 2, 6, 5, (24, 34, 38), 3)
    s.rect("hat", "front", 2, 3, 3, 3, (70, 96, 104), 3)
    for side in ("left", "right"):
        s.rect("hat", side, 3, 3, 5, 4, plate)
    s.ring("jacket", 0, plate)
    s.ring("jacket", 1, plate, 0.8)
    for x in range(1, 7):
        s.put("jacket", "front", x, 4, (214, 162, 30) if x % 2 else (30, 30, 28), 3)
    s.rect("jacket", "back", 2, 3, 5, 7, plate)
    for arm in ("rsleeve", "lsleeve"):
        s.rect(arm, "front", 0, 0, 3, 3, plate)
        for side in ("left", "right", "back"):
            s.rect(arm, side, 0, 0, 3, 3, plate)
        s.fill(arm, plate, sides=("top",))
    return s


def assault():
    """Coyote uniform under a dark plate carrier, helmet with goggles pushed up."""
    s = base(2, (198, 150, 112), (150, 128, 92), (60, 62, 58), hair=(30, 26, 22), eyes=(70, 52, 36))
    helmet(s, (118, 104, 76), rows=3)
    s.rect("hat", "front", 1, 1, 6, 1, (30, 30, 30), 2)
    for x in (2, 5):
        s.put("hat", "front", x, 1, (120, 150, 160), 2)
    for side in ("left", "right"):
        s.rect("hat", side, 0, 1, 7, 1, (30, 30, 30), 2)
    s.rect("head", "front", 0, 6, 7, 7, (44, 46, 44))
    for side in ("left", "right", "back"):
        s.rect("head", side, 0, 6, 7, 7, (44, 46, 44))
    for x in (1, 3, 5):
        s.rect("jacket", "front", x, 5, x + 1, 7, (48, 50, 46))
    s.rect("lsleeve", "left", 0, 1, 3, 3, (60, 62, 58))
    for leg in ("rpants", "lpants"):
        s.rect(leg, "front", 0, 4, 3, 6, (48, 50, 46))
    return s


def scout():
    """Woodland camouflage, hood and face paint for moving unseen."""
    camo = [(74, 92, 58), (52, 68, 44), (104, 98, 66), (60, 54, 40)]
    s = base(3, (176, 130, 96), camo[0], (58, 62, 44), hair=(40, 44, 32), eyes=(86, 110, 70))
    for part in ("body", "rarm", "larm", "rleg", "lleg"):
        s.camo(part, camo, rows=(0, 9))
    s.rect("body", "front", 2, 2, 5, 7, (58, 62, 44))
    s.ring("body", 10, STRAP)
    s.camo("hat", camo, sides=("top",))
    for side in SIDES:
        w = face("hat", side)[2]
        for x in range(w):
            for y in range(8 if side != "front" else 2):
                if side == "front" or y < 6 or s.random.random() < 0.6:
                    s.put("hat", side, x, y, s.random.choice(camo), 5)
    for x in (0, 1, 2, 5, 6, 7):
        s.put("head", "front", x, 5, (40, 52, 36), 3)
    for x in (0, 3, 4, 7):
        s.put("head", "front", x, 3, (40, 52, 36), 3)
    s.ring("jacket", 0, (96, 88, 60))
    s.ring("jacket", 1, (96, 88, 60), 0.6)
    return s


def medic():
    """Grey-green field uniform, white armband and pack marked with a red cross."""
    white, red = (226, 224, 214), (186, 44, 40)
    s = base(4, (232, 190, 156), (104, 116, 104), (140, 146, 132), hair=(96, 62, 36), eyes=(60, 110, 120))
    helmet(s, (120, 130, 116), rows=3)
    s.rect("hat", "front", 3, 0, 4, 1, white, 2)
    for side in ("left", "right"):
        s.rect("hat", side, 3, 0, 4, 2, white, 2)
        s.put("hat", side, 3, 1, red, 2)
        s.put("hat", side, 4, 1, red, 2)
    for y in (2, 3, 4):
        s.ring("lsleeve", y, white)
    s.put("lsleeve", "left", 1, 3, red, 2)
    s.put("lsleeve", "left", 2, 3, red, 2)
    s.put("lsleeve", "front", 1, 3, red, 2)
    s.rect("jacket", "back", 1, 1, 6, 8, white)
    s.rect("jacket", "back", 3, 2, 4, 7, red, 3)
    s.rect("jacket", "back", 2, 4, 5, 5, red, 3)
    s.rect("jacket", "front", 5, 2, 6, 3, white)
    s.put("jacket", "front", 5, 2, red, 2)
    for arm in ("rarm", "larm"):
        s.fill(arm, (150, 190, 200), sides=SIDES + ("bottom",), rows=(9, 12))
    return s


def engineer():
    """Graphite coveralls, high-visibility vest, hard hat and tool belt."""
    orange, band = (226, 120, 32), (214, 214, 196)
    s = base(5, (150, 104, 72), (58, 64, 72), orange, hair=(24, 22, 20), eyes=(54, 40, 30))
    helmet(s, (224, 176, 36), rows=3, brim=(196, 150, 28))
    s.put("hat", "front", 3, 0, (40, 40, 40))
    s.put("hat", "front", 4, 0, (40, 40, 40))
    for side in ("front", "back"):
        s.rect("body", side, 1, 4, 6, 4, band, 3)
        s.rect("body", side, 1, 7, 6, 7, band, 3)
    for x in (0, 2, 5, 7):
        s.rect("jacket", "front", x, 10, x, 11, (92, 70, 44))
    s.rect("jacket", "right", 0, 10, 3, 11, (92, 70, 44))
    s.put("jacket", "front", 2, 11, (170, 172, 170))
    for arm in ("rarm", "larm"):
        s.fill(arm, (196, 160, 60), sides=SIDES + ("bottom",), rows=(9, 12))
    for leg in ("rleg", "lleg"):
        s.ring(leg, 7, band)
    return s


for name, draw in (("sapper", sapper), ("assault", assault), ("scout", scout), ("medic", medic), ("engineer", engineer)):
    import os

    os.makedirs(f"{OUT}/{name}", exist_ok=True)
    draw().save(f"{OUT}/{name}/skin", glow=False)
