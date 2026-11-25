"""Draws the zombie skins (64x64 Minecraft layout) and their glow maps.

Run from the project root:  python3 tools/skin-forge/zombies.py
Three tiers share one face, one uniform and the same wounds; higher tiers add
decay, scrap armour and brighter eyes.
"""
from kit import SIDES, Skin, face

OUT = "public/assets/zombies"


BONE, BLOOD, MOUTH, SOCKET = (206, 200, 172), (112, 28, 26), (44, 20, 22), (22, 28, 22)


def zombie(tier):
    s = Skin(100 + tier)
    flesh = [(124, 152, 104), (108, 140, 104), (84, 98, 74)][tier - 1]
    rot = tuple(int(c * 0.72) for c in flesh)
    shirt = [(86, 94, 62), (78, 84, 58), (44, 50, 42)][tier - 1]
    trousers = [(66, 60, 52), (58, 54, 50), (34, 34, 36)][tier - 1]
    eye = [(190, 255, 90), (255, 176, 40), (255, 48, 32)][tier - 1]
    plate, rust = (84, 88, 88), (128, 82, 52)

    # Flesh everywhere first, with blotches of rot.
    for part in ("head", "body", "rarm", "larm", "rleg", "lleg"):
        s.fill(part, flesh)
        for side in SIDES:
            _, _, w, h = face(part, side)
            for _ in range(w * h // 7):
                s.put(part, side, s.random.randrange(w), s.random.randrange(h), rot)

    # Face: sunken sockets with a lit pupil, split nose, torn mouth, bone at the jaw.
    for x in range(8):
        if x not in (2, 5) or tier == 3:
            s.put("head", "front", x, 0, (34, 38, 30))
    for x in (0, 1, 6):
        s.put("head", "front", x, 1, (34, 38, 30))
    for x, lit in ((1, False), (2, True), (5, True), (6, False)):
        s.put("head", "front", x, 3, SOCKET, 2)
        s.put("head", "front", x, 4, eye if lit else SOCKET, 0, eye if lit else None)
    for x in (3, 4):
        s.put("head", "front", x, 5, rot)
    for x in range(2, 6):
        s.put("head", "front", x, 6, MOUTH, 3)
    for x in (3, 5):
        s.put("head", "front", x, 6, BONE)
    for x, y in ((6, 6), (7, 6), (6, 7)):
        s.put("head", "front", x, y, BONE)
    s.put("head", "front", 7, 5, BLOOD)
    s.put("head", "front", 1, 7, BLOOD)
    for x, y in ((0, 6), (1, 6), (0, 7)):
        s.put("head", "left", x, y, BONE)
    # Matted hair, thinner at each tier.
    hair = (34, 38, 30)
    for side in ("top", "back", "left", "right"):
        _, _, w, h = face("head", side)
        for y in range(h if side == "top" else 3 + (tier == 1)):
            for x in range(w):
                if s.random.random() < (0.9, 0.7, 0.45)[tier - 1]:
                    s.put("head", side, x, y, hair)

    # Field uniform: torn shirt, belt, trousers ripped at the knee, bare feet.
    s.fill("body", shirt, rows=(0, 10))
    s.ring("body", 10, (40, 36, 30))
    s.fill("body", trousers, sides=SIDES, rows=(11, 12))
    s.put("body", "front", 3, 10, (150, 140, 96))
    for x, y in ((5, 3), (6, 3), (5, 4), (6, 4), (6, 5), (1, 7), (2, 8)):
        s.put("body", "front", x, y, flesh)
    for x, y in ((5, 5), (6, 6), (1, 8)):
        s.put("body", "front", x, y, BLOOD)
    for y in (3, 5):
        s.put("body", "front", 6 if y == 3 else 5, y, BONE)
    for x, y in ((2, 2), (3, 2), (2, 3), (5, 8), (6, 8)):
        s.put("body", "back", x, y, flesh)
    for arm, torn in (("rarm", 5), ("larm", 3)):
        s.fill(arm, shirt, rows=(0, torn))
        s.ring(arm, torn, shirt, 0.5)
        s.ring(arm, 11, rot)
        s.fill(arm, shirt, sides=("top",))
    for y in (7, 8):
        s.put("rarm", "front", 1, y, BLOOD)
        s.put("rarm", "front", 2, y, BONE if y == 7 else BLOOD)
    for leg, knee in (("rleg", 4), ("lleg", 6)):
        s.fill(leg, trousers, rows=(0, 10))
        s.ring(leg, 9, trousers, 0.5)
        for x in (1, 2):
            s.put(leg, "front", x, knee, flesh)
            s.put(leg, "front", x, knee + 1, rot if x == 1 else flesh)
        s.fill(leg, rot, sides=("bottom",))

    if tier >= 2:
        # Scrap plate strapped over the chest, field dressing on one arm.
        for y in range(1, 7):
            for x in range(1, 7):
                s.put("jacket", "front", x, y, rust if (x + y * 3) % 7 == 0 else plate, 7)
        for x, y in ((1, 1), (6, 1), (1, 6), (6, 6)):
            s.put("jacket", "front", x, y, (150, 152, 148))
        for side in ("left", "right", "back"):
            for x in range(face("jacket", side)[2]):
                s.put("jacket", side, x, 2, (48, 40, 32))
                s.put("jacket", side, x, 5, (48, 40, 32))
        for y in (6, 7, 9):
            s.ring("lsleeve", y, (204, 196, 168), 0.9 if y != 9 else 0.6)
        s.put("lsleeve", "front", 1, 7, BLOOD)
    if tier == 3:
        # Embers show through cracks in the hide; a split helmet and spiked plate finish the look.
        ember = (255, 96, 28)
        cracks = {
            ("head", "front"): ((0, 2), (1, 2), (7, 3), (7, 4), (4, 7)),
            ("head", "right"): ((3, 4), (4, 5), (5, 5), (5, 6)),
            ("head", "left"): ((2, 3), (3, 4), (3, 5)),
            ("rarm", "right"): ((1, 6), (2, 7), (2, 8), (1, 9)),
            ("rarm", "front"): ((3, 9), (3, 10)),
            ("larm", "left"): ((2, 5), (1, 6), (1, 7), (2, 8), (2, 10)),
            ("larm", "front"): ((0, 4), (0, 5)),
            ("body", "back"): ((4, 4), (4, 5), (5, 6), (3, 7), (3, 8)),
            ("rleg", "front"): ((3, 2), (3, 3), (2, 7)),
            ("lleg", "front"): ((0, 3), (0, 4), (1, 8)),
        }
        for (part, side), pixels in cracks.items():
            for x, y in pixels:
                s.put(part, side, x, y, ember, 0, ember)
        for x in (2, 5):
            s.put("jacket", "front", x, 3, ember, 0, ember)
            s.put("jacket", "front", x, 4, ember, 0, ember)
        helmet = (52, 56, 58)
        s.fill("hat", helmet, sides=("top",), spread=6)
        for side in SIDES:
            w = face("hat", side)[2]
            for x in range(w):
                depth = 4 if side != "front" else (3 if x in (0, 1, 6, 7) else 2)
                if side == "left" and x > 4:
                    depth = 1
                for y in range(depth):
                    s.put("hat", side, x, y, rust if (x * 5 + y) % 9 == 0 else helmet, 6)
        for x, y in ((3, 0), (3, 1), (4, 2), (4, 3), (5, 4)):
            s.put("hat", "top", x, y + 2, ember, 0, ember)
        for y in range(0, 5):
            s.ring("rsleeve", y, plate if y % 2 else helmet, 0.92)
    s.save(f"{OUT}/zombie-{tier}")


for tier in (1, 2, 3):
    zombie(tier)
