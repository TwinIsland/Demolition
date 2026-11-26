import type * as THREE from "three";
import { Forge, seeded } from "./kit";

/**
 * Backrooms set: what an emptied office floor leaves behind. Authored in world units: a tile is
 * 2.4 wide and models stand on y = 0.
 */
const PI = Math.PI;

/** Moving boxes, stacked three high and taped shut. */
function cardboardBoxes() {
  const f = new Forge("cardboard-boxes");
  const random = seeded(23);
  const carton = (w: number, h: number, d: number, at: readonly [number, number, number], turn: number) =>
    f.frame({ at, rot: [0, turn, 0] }, () => {
      f.box("cardboard", [w, h, d], { at: [0, h / 2, 0] }, 0.012);
      // Packing tape over the top seam and a hand's width down each end.
      f.box("paint-sand", [w + 0.006, 0.006, 0.09], { at: [0, h + 0.001, 0] }, 0);
      for (const side of [-1, 1])
        f.box("paint-sand", [0.006, 0.16, 0.09], { at: [(side * w) / 2, h - 0.08, 0] }, 0);
    });
  carton(0.98, 0.62, 0.8, [-0.36, 0, -0.2], 0.08);
  carton(0.86, 0.56, 0.72, [0.52, 0, 0.3], -0.22);
  carton(0.66, 0.42, 0.56, [-0.42, 0, 0.62], 0.5);
  carton(0.84, 0.52, 0.7, [-0.3, 0.62, -0.16], -0.14 + random() * 0.1);
  carton(0.7, 0.46, 0.58, [0.5, 0.56, 0.28], 0.3);
  carton(0.6, 0.4, 0.5, [-0.26, 1.14, -0.14], 0.42);
  return f.build();
}

/** Two four-drawer filing cabinets side by side, one drawer left open. */
function filingCabinet() {
  const f = new Forge("filing-cabinet");
  for (const [index, x] of [-0.42, 0.42].entries()) {
    f.box(index ? "paint-sand" : "paint-slate", [0.8, 1.86, 1.1], { at: [x, 0.95, 0] }, 0.015);
    f.box("steel-dark", [0.76, 0.04, 1.06], { at: [x, 0.02, 0] }, 0);
    for (let drawer = 0; drawer < 4; drawer++) {
      const y = 0.27 + drawer * 0.45,
        // The second drawer of the left cabinet hangs open.
        out = !index && drawer === 2 ? 0.34 : 0;
      f.box(index ? "paint-sand" : "paint-slate", [0.72, 0.4, 0.04 + out], { at: [x, y, 0.565 + out / 2] }, 0.008);
      f.box("steel", [0.3, 0.035, 0.04], { at: [x, y + 0.08, 0.6 + out] }, 0.008);
      f.box("paint-ivory", [0.2, 0.07, 0.008], { at: [x, y - 0.06, 0.588 + out] }, 0);
    }
  }
  return f.build();
}

/** A steel desk with a beige tube monitor, its keyboard and a swivel chair pushed in. */
function officeDesk() {
  const f = new Forge("office-desk");
  f.box("planks", [1.9, 0.06, 0.95], { at: [0, 0.76, 0] }, 0.012);
  for (const side of [-1, 1]) f.box("paint-graphite", [0.05, 0.73, 0.88], { at: [side * 0.9, 0.365, 0] }, 0.006);
  f.box("paint-graphite", [1.76, 0.5, 0.03], { at: [0, 0.46, -0.42] }, 0.004);
  // Drawer pedestal.
  f.box("paint-graphite", [0.5, 0.62, 0.8], { at: [0.6, 0.42, 0.02] }, 0.008);
  for (let drawer = 0; drawer < 3; drawer++) {
    f.box("paint-slate", [0.44, 0.17, 0.02], { at: [0.6, 0.23 + drawer * 0.2, 0.425] }, 0.004);
    f.box("steel", [0.16, 0.022, 0.025], { at: [0.6, 0.25 + drawer * 0.2, 0.44] }, 0.004);
  }
  // Monitor: a deep beige case, dark glass and a stubby foot.
  f.box("paint-ivory", [0.3, 0.05, 0.3], { at: [-0.3, 0.815, -0.1] }, 0.01);
  f.box("paint-ivory", [0.6, 0.5, 0.52], { at: [-0.3, 1.1, -0.12] }, 0.03);
  f.box("glass", [0.48, 0.37, 0.02], { at: [-0.3, 1.11, 0.145] }, 0.01);
  f.box("paint-ivory", [0.58, 0.035, 0.22], { at: [-0.3, 0.81, 0.3], rot: [0.08, 0, 0] }, 0.008);
  f.box("paint-graphite", [0.5, 0.012, 0.15], { at: [-0.3, 0.832, 0.3], rot: [0.08, 0, 0] }, 0);
  // A paper tray and a mug of pens.
  f.box("steel-dark", [0.36, 0.07, 0.28], { at: [0.55, 0.825, -0.15] }, 0.006);
  f.box("paint-ivory", [0.32, 0.02, 0.24], { at: [0.55, 0.865, -0.15], rot: [0, 0.1, 0] }, 0);
  f.cyl("paint-red", 0.05, 0.045, 0.11, { at: [0.2, 0.845, -0.25] }, 10);
  // Chair, turned a little away.
  f.frame({ at: [-0.25, 0, 0.92], rot: [0, 2.7, 0] }, () => {
    for (let i = 0; i < 5; i++) {
      const turn = (i * 2 * PI) / 5;
      f.box("steel-dark", [0.05, 0.04, 0.34], { at: [Math.sin(turn) * 0.17, 0.07, Math.cos(turn) * 0.17], rot: [0, turn, 0] }, 0.006);
      f.cyl("rubber", 0.035, 0.035, 0.04, { at: [Math.sin(turn) * 0.32, 0.035, Math.cos(turn) * 0.32], rot: [0, turn, PI / 2] }, 8);
    }
    f.cyl("steel", 0.03, 0.03, 0.36, { at: [0, 0.26, 0] }, 8);
    f.box("burlap-olive", [0.5, 0.09, 0.5], { at: [0, 0.48, 0] }, 0.035);
    f.box("steel-dark", [0.06, 0.4, 0.03], { at: [0, 0.68, -0.25] }, 0.006);
    f.box("burlap-olive", [0.46, 0.44, 0.07], { at: [0, 0.96, -0.24], rot: [-0.1, 0, 0] }, 0.03);
  });
  return f.build();
}

/** A water cooler with its bottle, next to a bin and a dead pot plant's empty tub. */
function waterCooler() {
  const f = new Forge("water-cooler");
  f.box("paint-ivory", [0.42, 1.05, 0.42], { at: [-0.25, 0.525, 0] }, 0.02);
  f.box("paint-slate", [0.3, 0.2, 0.02], { at: [-0.25, 0.78, 0.215] }, 0.006);
  f.box("steel-dark", [0.3, 0.03, 0.12], { at: [-0.25, 0.62, 0.26] }, 0.004);
  for (const [dx, colour] of [[-0.07, "paint-red"], [0.07, "paint-teal"]] as const)
    f.box(colour, [0.04, 0.05, 0.05], { at: [-0.25 + dx, 0.8, 0.235] }, 0.006);
  f.cyl("paint-ivory", 0.12, 0.17, 0.06, { at: [-0.25, 1.08, 0] }, 14);
  f.cyl("paint-teal", 0.17, 0.17, 0.36, { at: [-0.25, 1.29, 0] }, 16);
  f.cyl("paint-teal", 0.15, 0.17, 0.05, { at: [-0.25, 1.495, 0] }, 16);
  // Waste bin and a paper sack of shredded files.
  f.cyl("steel-dark", 0.19, 0.15, 0.38, { at: [0.32, 0.19, 0.1] }, 14);
  f.cyl("paint-ivory", 0.17, 0.17, 0.02, { at: [0.32, 0.36, 0.1] }, 14);
  f.box("cardboard", [0.4, 0.34, 0.3], { at: [0.25, 0.17, -0.35], rot: [0, 0.3, 0] }, 0.012);
  return f.build();
}

/** A freestanding cubicle partition in two hinged panels. */
function partition() {
  const f = new Forge("partition");
  for (const [x, z, turn] of [
    [-0.5, -0.12, 0.25],
    [0.5, 0.12, -0.25],
  ] as const)
    f.frame({ at: [x, 0, z], rot: [0, turn, 0] }, () => {
      f.box("steel-dark", [1.04, 0.05, 0.07], { at: [0, 0.065, 0] }, 0.006);
      f.box("burlap", [1, 1.5, 0.06], { at: [0, 0.84, 0] }, 0.012);
      f.box("steel-dark", [1.04, 0.04, 0.075], { at: [0, 1.61, 0] }, 0.006);
      for (const side of [-1, 1]) {
        f.box("steel-dark", [0.035, 1.6, 0.075], { at: [side * 0.51, 0.82, 0] }, 0.006);
        f.box("steel-dark", [0.06, 0.04, 0.36], { at: [side * 0.44, 0.02, 0] }, 0.006);
      }
    });
  return f.build();
}

export const office: Record<string, () => THREE.Group> = {
  "cardboard-boxes": cardboardBoxes,
  "filing-cabinet": filingCabinet,
  "office-desk": officeDesk,
  "water-cooler": waterCooler,
  partition,
};
