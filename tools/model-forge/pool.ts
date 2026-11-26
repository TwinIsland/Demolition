import * as THREE from "three";
import { Forge, seeded } from "./kit";
import { rosette } from "./jungle";

/**
 * Poolrooms set: the things a deserted indoor pool still has standing around. Authored in world
 * units: a tile is 2.4 wide and models stand on y = 0.
 */
const PI = Math.PI;

/** A stack of life rings, each in four alternating colour segments. */
function swimRings() {
  const f = new Forge("swim-rings");
  const random = seeded(41);
  for (let i = 0; i < 3; i++) {
    const turn = random() * PI,
      at = [(random() - 0.5) * 0.16, 0.21 + i * 0.4, (random() - 0.5) * 0.16] as const;
    for (let k = 0; k < 4; k++)
      f.add(k % 2 ? "paint-ivory" : "paint-red", new THREE.TorusGeometry(0.62, 0.21, 10, 8, PI / 2), {
        at,
        rot: [PI / 2, 0, turn + (k * PI) / 2],
      });
  }
  return f.build();
}

/** A tall lifeguard chair on splayed legs, with a ladder up the front. */
function lifeguardChair() {
  const f = new Forge("lifeguard-chair");
  const seat = 1.5,
    spread = 0.62,
    top = 0.4;
  for (const [sx, sz] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const) {
    const run = spread - top,
      length = Math.hypot(seat, run * Math.SQRT2);
    // Each leg leans from its foot towards the seat corner above it.
    f.frame({ at: [sx * (spread + top) * 0.5, seat / 2, sz * (spread + top) * 0.5] }, () =>
      f.cyl("paint-ivory", 0.045, 0.045, length, { rot: [(-sz * run) / seat, 0, (sx * run) / seat] }, 8),
    );
    f.cyl("rubber", 0.06, 0.07, 0.06, { at: [sx * spread, 0.03, sz * spread] }, 8);
  }
  // Ladder rungs between the front legs, which narrow towards the seat.
  for (let i = 1; i <= 4; i++) {
    const y = (i * seat) / 5,
      half = spread - ((spread - top) * y) / seat;
    f.cyl("steel", 0.028, 0.028, half * 2, { at: [0, y, half], rot: [0, 0, PI / 2] }, 6);
    f.cyl("paint-ivory", 0.025, 0.025, half * 2, { at: [0, y, -half], rot: [0, 0, PI / 2] }, 6);
  }
  f.box("paint-ivory", [1, 0.08, 1], { at: [0, seat, 0] }, 0.03);
  f.box("paint-red", [0.84, 0.1, 0.8], { at: [0, seat + 0.09, 0.02] }, 0.04);
  f.box("paint-ivory", [0.92, 0.82, 0.07], { at: [0, seat + 0.45, -0.46], rot: [-0.12, 0, 0] }, 0.03);
  f.box("paint-red", [0.74, 0.5, 0.05], { at: [0, seat + 0.5, -0.41], rot: [-0.12, 0, 0] }, 0.02);
  for (const side of [-1, 1]) {
    f.box("paint-ivory", [0.07, 0.07, 0.86], { at: [side * 0.47, seat + 0.36, 0] }, 0.02);
    f.box("paint-ivory", [0.07, 0.34, 0.07], { at: [side * 0.47, seat + 0.2, 0.4] }, 0.02);
  }
  return f.build();
}

/** A bank of three changing-room lockers. */
function locker() {
  const f = new Forge("locker");
  f.box("steel-dark", [1.74, 0.12, 0.84], { at: [0, 0.06, 0] }, 0.01);
  f.box("paint-slate", [1.8, 1.9, 0.9], { at: [0, 1.07, 0] }, 0.02);
  for (let i = -1; i <= 1; i++) {
    const x = i * 0.585;
    f.box("paint-teal", [0.54, 1.74, 0.04], { at: [x, 1.07, 0.455] }, 0.012);
    for (let slot = 0; slot < 4; slot++)
      f.box("steel-dark", [0.32, 0.022, 0.02], { at: [x, 1.7 - slot * 0.06, 0.478] }, 0);
    f.box("steel", [0.045, 0.16, 0.035], { at: [x + 0.19, 1.08, 0.488] }, 0.008);
    f.box("paint-ivory", [0.14, 0.07, 0.012], { at: [x, 1.44, 0.478] }, 0);
  }
  f.box("paint-slate", [1.84, 0.05, 0.94], { at: [0, 2.03, 0] }, 0.012);
  return f.build();
}

/** A tiled planter with a broad-leaved pot plant. */
function planter() {
  const f = new Forge("planter");
  const random = seeded(77);
  f.box("pool-tile", [1.5, 0.72, 1.5], { at: [0, 0.36, 0] }, 0.03);
  f.box("ground", [1.26, 0.06, 1.26], { at: [0, 0.71, 0] }, 0);
  f.cyl("jungle-bark", 0.07, 0.1, 0.5, { at: [0, 0.95, 0] }, 8, true);
  rosette(f, "leaf", random, 9, { length: 1.25, width: 0.42, rise: 1.05, droop: 1.5 }, [0, 1.15, 0]);
  rosette(f, "leaf-dark", random, 6, { length: 0.9, width: 0.36, rise: 0.7, droop: 1.2 }, [0, 0.95, 0]);
  return f.build();
}

/** A wheeled cart of folded towels. */
function towelCart() {
  const f = new Forge("towel-cart");
  const random = seeded(19);
  const w = 1.5,
    d = 0.9;
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      f.cyl("steel", 0.03, 0.03, 1.3, { at: [(sx * w) / 2, 0.8, (sz * d) / 2] }, 8);
      f.cyl("rubber", 0.085, 0.085, 0.05, { at: [(sx * w) / 2, 0.085, (sz * d) / 2], rot: [PI / 2, 0, 0] }, 12);
    }
  for (const sz of [-1, 1]) f.cyl("steel", 0.026, 0.026, w, { at: [0, 1.45, (sz * d) / 2], rot: [0, 0, PI / 2] }, 8);
  const colours = ["paint-ivory", "paint-teal", "paint-ivory", "paint-yellow"];
  for (const [level, shelf] of [0.22, 0.78].entries()) {
    f.box("steel", [w + 0.06, 0.035, d + 0.06], { at: [0, shelf, 0] }, 0.01);
    for (let column = -1; column <= 1; column++) {
      const stack = 2 + Math.floor(random() * (level ? 3 : 2));
      for (let i = 0; i < stack; i++)
        f.box(
          colours[Math.floor(random() * colours.length)],
          [0.42, 0.11, 0.66 + random() * 0.08],
          { at: [column * 0.47 + (random() - 0.5) * 0.03, shelf + 0.075 + i * 0.112, (random() - 0.5) * 0.04] },
          0.045,
        );
    }
  }
  return f.build();
}

export const pool: Record<string, () => THREE.Group> = {
  "swim-rings": swimRings,
  "lifeguard-chair": lifeguardChair,
  locker,
  planter,
  "towel-cart": towelCart,
};
