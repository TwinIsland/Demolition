import type * as THREE from "three";
import { Forge } from "./kit";

/**
 * Air-delivered ordnance. Models point straight up (nose at +Y) with the tail at y = 0;
 * the game turns them along their flight path.
 */
const PI = Math.PI;

/** Cruise missile for the Missile Strike perk, 4.2 units long. */
function missile() {
  const f = new Forge("missile", 2);
  const r = 0.3;
  // Engine bell and tail ring.
  f.lathe(
    "steel-dark",
    [
      [0.16, 0],
      [0.23, 0.05],
      [0.2, 0.3],
      [r, 0.36],
    ],
    {},
    20,
  );
  f.cyl("steel-dark", 0.14, 0.17, 0.05, { at: [0, 0.03, 0] }, 16);
  // Body, banded with a hazard stripe and a red guidance collar.
  f.cyl("paint-olive", r, r, 1.1, { at: [0, 0.91, 0] }, 24);
  f.cyl("hazard", r + 0.004, r + 0.004, 0.2, { at: [0, 1.56, 0] }, 24);
  f.cyl("paint-olive", r, r, 1.2, { at: [0, 2.26, 0] }, 24);
  f.cyl("steel", r + 0.012, r + 0.012, 0.06, { at: [0, 2.89, 0] }, 24);
  f.cyl("paint-red", r, r, 0.22, { at: [0, 3.03, 0] }, 24);
  // Ogive nose with a seeker window at the tip.
  f.lathe(
    "paint-graphite",
    [
      [r, 3.14],
      [0.285, 3.4],
      [0.24, 3.66],
      [0.17, 3.9],
      [0.1, 4.06],
    ],
    {},
    24,
  );
  f.sphere("glass", 0.105, { at: [0, 4.07, 0], scale: [1, 1.25, 1] }, 14);
  // Cable raceway along one side.
  f.box("steel-dark", [0.07, 1.9, 0.05], { at: [0, 1.75, r + 0.012] }, 0.012);
  for (let k = 0; k < 4; k++)
    f.frame({ rot: [0, (k * PI) / 2 + PI / 4, 0] }, () => {
      // Swept tail fin, then a small mid-body wing.
      f.extrude(
        "paint-graphite",
        [
          [r - 0.02, 0.08],
          [r + 0.5, 0.02],
          [r + 0.5, 0.3],
          [r - 0.02, 0.92],
        ],
        0.035,
        {},
        0.008,
      );
      f.extrude(
        "paint-olive",
        [
          [r - 0.02, 2.1],
          [r + 0.26, 2.16],
          [r + 0.26, 2.36],
          [r - 0.02, 2.7],
        ],
        0.03,
        {},
        0.008,
      );
      f.box("steel", [0.05, 0.05, 0.05], { at: [r + 0.01, 0.5, 0] }, 0.01);
    });
  return f.build();
}

export const ordnance: Record<string, () => THREE.Group> = { missile };
