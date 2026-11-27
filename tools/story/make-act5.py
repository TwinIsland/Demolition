"""Art of act 5 and its endings, written to src/story/shutdown/art/.

    python3 tools/story/make-act5.py [folder with the owner's paintings]

The folder (default /mnt/project-files/Demolition-story/art) holds the paintings by the names of
Demolition-story/art/act5-asset-prompts.md. The two rooms (bedroom-morning-bg.png, dining-bg.png)
are brought down to the 320 x 180 stage; the comic panels (comic-5, 5b, 6a, 6b) become webp.
A panel that is missing is left out, and the act falls back to its 3D shots.
"""

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "src/story/shutdown/art"
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/mnt/project-files/Demolition-story/art")
VIEW = (320, 180)
PANEL_WIDTH = 1672

OUT.mkdir(parents=True, exist_ok=True)
for source, name in (("bedroom-morning-bg", "bedroom-morning"), ("dining-bg", "dining")):
    small = Image.open(SOURCE / f"{source}.png").convert("RGB").resize(VIEW, Image.BOX)
    small.quantize(64, method=Image.MEDIANCUT, dither=Image.NONE).convert("RGB").save(OUT / f"{name}.png")
for name in ("comic-5", "comic-5b", "comic-6a", "comic-6b"):
    panel = SOURCE / f"{name}.png"
    if not panel.exists():
        continue
    image = Image.open(panel).convert("RGB")
    if image.width > PANEL_WIDTH:
        image = image.resize((PANEL_WIDTH, round(image.height * PANEL_WIDTH / image.width)), Image.LANCZOS)
    image.save(OUT / f"{name}.webp", quality=84, method=6)
