import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { Forge, seeded, type Vec3 } from "./kit";

/** Obstacle presets, authored in world units: a tile is 2.4 wide and the model stands on y = 0. */
const PI = Math.PI;
const sides = (f: Forge, build: (k: number) => void) => {
  for (let k = 0; k < 4; k++)
    f.frame({ rot: [0, (k * PI) / 2, 0] }, () => build(k));
};

function crate() {
  const f = new Forge("crate");
  for (const z of [-0.6, 0.6])
    f.box("planks-dark", [1.9, 0.1, 0.24], { at: [0, 0.05, z] }, 0.015);
  f.box("planks", [1.8, 1.62, 1.8], { at: [0, 0.91, 0] }, 0.012);
  sides(f, () => {
    const z = 0.925;
    for (const y of [0.19, 1.63])
      f.box("planks-dark", [1.9, 0.17, 0.06], { at: [0, y, z] }, 0.012);
    for (const x of [-0.865, 0.865])
      f.box("planks-dark", [0.17, 1.27, 0.06], { at: [x, 0.91, z] }, 0.012);
    f.box(
      "planks-dark",
      [0.15, 2.0, 0.045],
      { at: [0, 0.91, z - 0.006], rot: [0, 0, Math.atan2(1.56, 1.27)] },
      0.012,
    );
    for (const x of [-0.9, 0.9])
      for (const y of [0.19, 1.63])
        f.box(
          "steel",
          [0.14, 0.2, 0.012],
          { at: [x * 0.955, y, z + 0.034] },
          0,
        );
  });
  f.box("planks-dark", [1.96, 0.07, 1.96], { at: [0, 1.755, 0] }, 0.015);
  for (const x of [-0.5, 0.5])
    f.box("steel", [0.09, 0.012, 1.98], { at: [x, 1.795, 0] }, 0);
  return f.build();
}

/** Crate a player builds during a match. Each side and the lid carry a flat panel for the owner's emblem. */
function builtCrate() {
  const f = new Forge("built-crate");
  for (const z of [-0.6, 0.6])
    f.box("planks-dark", [1.9, 0.1, 0.24], { at: [0, 0.05, z] }, 0.015);
  f.box("planks", [1.8, 1.62, 1.8], { at: [0, 0.91, 0] }, 0.012);
  sides(f, () => {
    const z = 0.925;
    for (const y of [0.19, 1.63])
      f.box("planks-dark", [1.9, 0.17, 0.06], { at: [0, y, z] }, 0.012);
    for (const x of [-0.865, 0.865])
      f.box("planks-dark", [0.17, 1.27, 0.06], { at: [x, 0.91, z] }, 0.012);
    f.box("paint-olive", [1.06, 1.06, 0.05], { at: [0, 0.91, 0.94] }, 0.012);
    for (const x of [-0.47, 0.47])
      for (const y of [0.44, 1.38])
        f.cyl(
          "steel",
          0.03,
          0.03,
          0.02,
          { at: [x, y, 0.968], rot: [PI / 2, 0, 0] },
          8,
        );
    f.box("steel", [0.2, 0.26, 0.14], { at: [0.89, 1.66, 0.89] }, 0.01);
    f.box("steel", [0.2, 0.26, 0.14], { at: [0.89, 0.16, 0.89] }, 0.01);
  });
  f.box("planks-dark", [1.96, 0.07, 1.96], { at: [0, 1.755, 0] }, 0.015);
  f.box("paint-olive", [0.86, 0.02, 0.86], { at: [0, 1.795, 0] }, 0.006);
  for (const x of [-0.56, 0.56])
    f.box("steel", [0.09, 0.012, 1.98], { at: [x, 1.795, 0] }, 0);
  return f.build();
}

function ammoBox(f: Forge, at: Vec3, turned: boolean, stripe: string) {
  f.frame({ at, rot: [0, turned ? PI / 2 : 0, 0] }, () => {
    f.box("paint-olive", [0.92, 0.4, 0.6], {}, 0.025);
    f.box("paint-olive", [0.94, 0.05, 0.62], { at: [0, 0.1, 0] }, 0);
    f.box(stripe, [0.925, 0.07, 0.605], { at: [0, -0.07, 0] }, 0);
    for (const x of [-0.26, 0.26])
      f.box("steel", [0.07, 0.13, 0.02], { at: [x, 0.07, 0.31] }, 0);
    for (const x of [-0.475, 0.475])
      f.box("rubber", [0.02, 0.05, 0.22], { at: [x, 0, 0] }, 0);
  });
}
function pallet() {
  const f = new Forge("pallet");
  for (const x of [-0.86, 0, 0.86])
    f.box("planks-dark", [0.14, 0.12, 1.9], { at: [x, 0.06, 0] }, 0.01);
  for (let i = 0; i < 7; i++)
    f.box(
      "planks",
      [1.92, 0.035, 0.22],
      { at: [0, 0.138, -0.84 + i * 0.28] },
      0,
    );
  const base = 0.155 + 0.2,
    step = 0.415;
  for (const x of [-0.475, 0.475])
    for (const z of [-0.63, 0, 0.63])
      ammoBox(f, [x, base, z], false, "paint-yellow");
  for (const x of [-0.63, 0, 0.63])
    for (const z of [-0.475, 0.475])
      ammoBox(f, [x, base + step, z], true, "paint-yellow");
  ammoBox(f, [-0.475, base + step * 2, -0.63], false, "paint-red");
  ammoBox(f, [-0.475, base + step * 2, 0], false, "paint-yellow");
  ammoBox(f, [0.5, base + step * 2, -0.4], false, "paint-yellow");
  for (const z of [-0.3, 0.3]) {
    f.box(
      "steel-dark",
      [1.95, 0.012, 0.05],
      { at: [0, base + step * 1.5 + 0.03, z] },
      0,
    );
    for (const x of [-0.972, 0.972])
      f.box(
        "steel-dark",
        [0.012, step * 2 + 0.06, 0.05],
        { at: [x, base + step * 0.5, z] },
        0,
      );
  }
  return f.build();
}

function oilDrum(f: Forge, at: Vec3, paint: string, turn: number) {
  const r = 0.44,
    h = 1.32;
  const ribs = [0.44, 0.88].flatMap(
    (y) =>
      [
        [r, y - 0.04],
        [r + 0.016, y - 0.02],
        [r + 0.016, y + 0.02],
        [r, y + 0.04],
      ] as const,
  );
  f.frame({ at, rot: [0, turn, 0] }, () => {
    f.lathe(
      paint,
      [
        [0, 0],
        [r - 0.02, 0],
        [r + 0.012, 0.012],
        [r + 0.012, 0.04],
        [r, 0.055],
        ...ribs,
        [r, h - 0.055],
        [r + 0.012, h - 0.04],
        [r + 0.012, h],
        [r - 0.022, h],
        [r - 0.022, h - 0.035],
        [0, h - 0.035],
      ],
      {},
      22,
    );
    f.cyl("steel", 0.05, 0.05, 0.03, { at: [0.26, h - 0.022, 0.04] }, 10);
    f.cyl("steel", 0.028, 0.028, 0.03, { at: [-0.27, h - 0.022, -0.1] }, 8);
  });
}
function drum() {
  const f = new Forge("drum");
  oilDrum(f, [-0.47, 0, -0.47], "paint-olive", 0.4);
  oilDrum(f, [0.47, 0, -0.47], "paint-graphite", 1.9);
  oilDrum(f, [-0.47, 0, 0.47], "paint-red", 3.1);
  oilDrum(f, [0.47, 0, 0.47], "paint-olive", 4.4);
  // Hand pump on one drum breaks the flat top line.
  f.cyl("steel-dark", 0.035, 0.035, 0.42, { at: [0.73, 1.5, 0.51] }, 8);
  f.cyl("steel-dark", 0.06, 0.06, 0.07, { at: [0.73, 1.34, 0.51] }, 10);
  f.box(
    "steel-dark",
    [0.3, 0.035, 0.035],
    { at: [0.62, 1.66, 0.51], rot: [0, 0, -0.25] },
    0.01,
  );
  f.box(
    "paint-yellow",
    [0.035, 0.24, 0.035],
    { at: [0.73, 1.78, 0.51], rot: [0, 0, 0.5] },
    0.01,
  );
  return f.build();
}

function sandbag(
  length: number,
  height: number,
  width: number,
  random: () => number,
) {
  const g = new THREE.SphereGeometry(1, 10, 6);
  const p = g.attributes.position;
  const sag = 0.82 + random() * 0.3;
  for (let i = 0; i < p.count; i++) {
    const pillow = (v: number, e: number) => Math.sign(v) * Math.abs(v) ** e;
    const x = pillow(p.getX(i), 0.55),
      y = pillow(p.getY(i), 0.7),
      z = pillow(p.getZ(i), 0.6);
    p.setXYZ(
      i,
      (x * length) / 2,
      ((y * height) / 2) * (1 - 0.12 * sag * Math.abs(x)),
      (z * width) / 2,
    );
  }
  g.computeVertexNormals();
  return g;
}
function bags() {
  const f = new Forge("bags", 0.9),
    random = seeded(41);
  const layer = 0.27;
  for (let row = 0; row < 5; row++) {
    const along = row % 2 === 0;
    for (const a of [-0.49, 0.49])
      for (const b of [-0.65, 0, 0.65]) {
        if (row === 4 && ((a > 0 && b > 0.3) || (a < 0 && b < -0.3))) continue;
        const jitter = () => (random() - 0.5) * 0.05;
        f.add(
          row === 2 && b === 0 ? "burlap-olive" : "burlap",
          sandbag(1.0, 0.36, 0.68, random),
          {
            at: along
              ? [a + jitter(), 0.17 + row * layer, b + jitter()]
              : [b + jitter(), 0.17 + row * layer, a + jitter()],
            rot: [jitter(), (along ? 0 : PI / 2) + jitter() * 2.4, jitter()],
          },
        );
      }
  }
  return f.build();
}

function hesco() {
  const f = new Forge("hesco", 1.2);
  f.box("burlap", [1.86, 1.72, 1.86], { at: [0, 0.86, 0] }, 0.07);
  sides(f, () => {
    for (let i = 0; i < 7; i++)
      f.box(
        "steel-dark",
        [0.022, 1.74, 0.022],
        { at: [-0.9 + i * 0.3, 0.87, 0.945] },
        0,
      );
    for (let i = 0; i < 6; i++)
      f.box(
        "steel-dark",
        [1.86, 0.022, 0.022],
        { at: [0, 0.12 + i * 0.3, 0.948] },
        0,
      );
    f.cyl("steel-dark", 0.03, 0.03, 1.76, { at: [0.945, 0.88, 0.945] }, 6);
  });
  const mound = new THREE.SphereGeometry(1, 14, 8, 0, PI * 2, 0, PI / 2);
  f.add("ground", mound, { at: [0, 1.7, 0], scale: [0.86, 0.19, 0.86] });
  return f.build();
}

function barricade() {
  const f = new Forge("barricade");
  const profile = [
    [-0.42, 0],
    [0.42, 0],
    [0.42, 0.14],
    [0.24, 0.42],
    [0.13, 1.36],
    [0.11, 1.4],
    [-0.11, 1.4],
    [-0.13, 1.36],
    [-0.24, 0.42],
    [-0.42, 0.14],
  ] as const;
  for (const x of [-0.56, 0.56]) {
    f.extrude("concrete", profile, 1.98, { at: [x, 0, 0] }, 0.02);
    f.box("hazard", [0.275, 0.03, 1.94], { at: [x, 1.405, 0] }, 0.008);
    for (const z of [-0.6, 0.6])
      f.torus(
        "steel",
        0.09,
        0.02,
        { at: [x, 1.42, z], rot: [0, PI / 2, 0] },
        10,
        PI,
      );
    for (const side of [-1, 1])
      f.box(
        "hazard",
        [0.02, 0.26, 1.9],
        { at: [x + side * 0.34, 0.27, 0], rot: [0, 0, side * 0.572] },
        0,
      );
  }
  for (const z of [-0.7, 0.7])
    f.cyl(
      "steel-dark",
      0.04,
      0.04,
      0.9,
      { at: [0, 1.0, z], rot: [0, 0, PI / 2] },
      8,
    );
  return f.build();
}

function press() {
  const f = new Forge("press");
  f.box("paint-graphite", [1.86, 0.52, 1.5], { at: [0, 0.26, 0] }, 0.04);
  f.box("steel", [1.3, 0.07, 1.1], { at: [0, 0.555, 0] }, 0.015);
  for (const x of [-0.74, 0.74])
    for (const z of [-0.54, 0.54]) {
      f.cyl("steel", 0.085, 0.085, 1.16, { at: [x, 1.1, z] }, 12);
      f.cyl("steel-dark", 0.13, 0.13, 0.09, { at: [x, 0.565, z] }, 8);
      f.cyl("steel-dark", 0.13, 0.13, 0.09, { at: [x, 2.145, z] }, 8);
    }
  f.box("paint-olive", [1.86, 0.5, 1.46], { at: [0, 1.85, 0] }, 0.04);
  for (const z of [-0.735, 0.735])
    f.box("hazard", [1.8, 0.13, 0.012], { at: [0, 1.69, z] }, 0);
  f.cyl("steel", 0.2, 0.2, 0.42, { at: [0, 1.4, 0] }, 16);
  f.cyl("paint-olive", 0.3, 0.3, 0.12, { at: [0, 1.57, 0] }, 16);
  f.box("paint-graphite", [1.04, 0.14, 0.9], { at: [0, 1.13, 0] }, 0.025);
  f.box("steel", [0.5, 0.1, 0.5], { at: [0, 0.64, 0] }, 0.015);
  // Hydraulic line and gauge give the front a readable face.
  f.cyl("rubber", 0.03, 0.03, 0.75, { at: [0.5, 1.3, 0.62] }, 8);
  f.cyl(
    "steel",
    0.1,
    0.1,
    0.05,
    { at: [-0.5, 1.85, 0.745], rot: [PI / 2, 0, 0] },
    14,
  );
  f.box("paint-red", [0.16, 0.16, 0.05], { at: [0.55, 0.3, 0.76] }, 0.02);
  return f.build();
}

function hopper() {
  const f = new Forge("hopper");
  for (const x of [-0.82, 0.82])
    for (const z of [-0.82, 0.82]) {
      f.box("steel-dark", [0.11, 1.5, 0.11], { at: [x, 0.75, z] }, 0.012);
      f.box("steel-dark", [0.24, 0.03, 0.24], { at: [x, 0.015, z] }, 0);
    }
  sides(f, () => {
    f.box("steel-dark", [1.64, 0.07, 0.07], { at: [0, 0.36, 0.82] }, 0.01);
    f.box(
      "steel-dark",
      [1.95, 0.05, 0.05],
      { at: [0, 0.86, 0.82], rot: [0, 0, 0.56] },
      0.008,
    );
    f.box("hazard", [1.9, 0.13, 0.012], { at: [0, 1.83, 0.957] }, 0);
  });
  f.prism("paint-sand", 0.94 * Math.SQRT2, 0.3 * Math.SQRT2, 0.92, 4, {
    at: [0, 1.14, 0],
    rot: [0, PI / 4, 0],
  });
  f.box("paint-sand", [1.9, 0.5, 1.9], { at: [0, 1.83, 0] }, 0.025);
  f.box("steel", [1.98, 0.07, 1.98], { at: [0, 2.07, 0] }, 0.015);
  f.box("steel", [0.62, 0.2, 0.62], { at: [0, 0.6, 0] }, 0.015);
  f.box("steel-dark", [0.9, 0.03, 0.2], { at: [0.2, 0.5, 0] }, 0);
  const heap = new THREE.SphereGeometry(1, 12, 6, 0, PI * 2, 0, PI / 2);
  f.add("ground", heap, { at: [0, 2.06, 0], scale: [0.86, 0.14, 0.86] });
  return f.build();
}

function valve() {
  const f = new Forge("valve");
  const along: Vec3 = [0, 0, PI / 2];
  f.cyl("paint-slate", 0.42, 0.42, 2.0, { at: [0, 0.8, 0], rot: along }, 20);
  for (const x of [-0.97, -0.5, 0.5, 0.97]) {
    f.cyl("steel", 0.56, 0.56, 0.07, { at: [x, 0.8, 0], rot: along }, 20);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PI * 2 + 0.39;
      f.cyl(
        "steel-dark",
        0.035,
        0.035,
        0.11,
        { at: [x, 0.8 + Math.sin(a) * 0.49, Math.cos(a) * 0.49], rot: along },
        6,
      );
    }
  }
  f.box("paint-slate", [0.74, 1.0, 0.98], { at: [0, 0.8, 0] }, 0.1);
  f.cyl("paint-slate", 0.24, 0.3, 0.34, { at: [0, 1.45, 0] }, 14);
  f.cyl("steel", 0.34, 0.34, 0.06, { at: [0, 1.3, 0] }, 14);
  f.cyl("steel", 0.05, 0.05, 0.36, { at: [0, 1.76, 0] }, 8);
  f.torus(
    "paint-red",
    0.4,
    0.045,
    { at: [0, 1.86, 0], rot: [PI / 2, 0, 0] },
    24,
  );
  for (const turn of [0, PI / 2])
    f.box(
      "paint-red",
      [0.8, 0.045, 0.06],
      { at: [0, 1.86, 0], rot: [0, turn + 0.3, 0] },
      0.012,
    );
  f.cyl("paint-red", 0.09, 0.09, 0.08, { at: [0, 1.87, 0] }, 10);
  for (const x of [-0.74, 0.74]) {
    f.box("concrete", [0.36, 0.46, 1.14], { at: [x, 0.23, 0] }, 0.03);
    f.box("steel-dark", [0.1, 0.03, 1.2], { at: [x, 1.235, 0] }, 0);
  }
  return f.build();
}

function robotArm() {
  const f = new Forge("robot-arm");
  f.box("steel-dark", [1.9, 0.1, 1.9], { at: [0, 0.05, 0] }, 0.02);
  sides(f, () =>
    f.box("hazard", [1.9, 0.012, 0.2], { at: [0, 0.104, 0.85] }, 0),
  );
  f.cyl("paint-graphite", 0.56, 0.62, 0.34, { at: [0, 0.27, 0] }, 20);
  f.cyl("paint-yellow", 0.44, 0.44, 0.36, { at: [0, 0.62, 0] }, 20);
  f.box("paint-yellow", [0.62, 0.62, 0.74], { at: [-0.05, 1.06, 0] }, 0.07);
  f.cyl(
    "paint-graphite",
    0.3,
    0.3,
    0.86,
    { at: [-0.05, 1.12, 0], rot: [PI / 2, 0, 0] },
    16,
  );
  f.frame({ at: [-0.05, 1.12, 0], rot: [0, 0, 0.3] }, () => {
    f.box("paint-yellow", [0.32, 1.0, 0.36], { at: [0, 0.5, 0] }, 0.05);
    f.frame({ at: [0, 1.0, 0], rot: [0, 0, -0.3 - 1.9] }, () => {
      f.cyl("paint-graphite", 0.23, 0.23, 0.58, { rot: [PI / 2, 0, 0] }, 14);
      f.box("paint-yellow", [0.27, 0.8, 0.3], { at: [0, 0.4, 0] }, 0.045);
      f.cyl("paint-graphite", 0.15, 0.15, 0.16, { at: [0, 0.86, 0] }, 12);
      f.box("steel", [0.3, 0.06, 0.2], { at: [0, 0.96, 0] }, 0.01);
      for (const x of [-0.12, 0.12])
        f.box("steel", [0.04, 0.2, 0.14], { at: [x, 1.07, 0] }, 0.01);
    });
  });
  f.cyl(
    "rubber",
    0.035,
    0.035,
    0.8,
    { at: [-0.36, 1.5, 0.2], rot: [0, 0, 0.42] },
    6,
  );
  // Controller cabinet fills the corner the arm leaves empty.
  f.box("paint-graphite", [0.5, 0.95, 0.42], { at: [0.66, 0.575, -0.7] }, 0.03);
  f.box("paint-red", [0.1, 0.1, 0.03], { at: [0.66, 0.85, -0.485] }, 0.012);
  f.box("steel", [0.3, 0.2, 0.012], { at: [0.66, 0.6, -0.487] }, 0);
  return f.build();
}

function plantingBed(f: Forge) {
  sides(f, () =>
    f.box("planks-dark", [2.04, 0.36, 0.2], { at: [0.0, 0.18, 0.92] }, 0.02),
  );
  f.box("ground", [1.7, 0.3, 1.7], { at: [0, 0.16, 0] }, 0);
}
function lump(
  radius: number,
  detail: number,
  random: () => number,
  squash = 1,
) {
  const faceted = new THREE.IcosahedronGeometry(radius, detail);
  faceted.deleteAttribute("normal");
  faceted.deleteAttribute("uv");
  const g = mergeVertices(faceted);
  const p = g.attributes.position,
    phase = random() * 9;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i);
    const k =
      1 +
      0.16 *
        Math.sin((x * 5.1) / radius + phase) *
        Math.cos((z * 4.3) / radius - phase) +
      0.1 * Math.sin((y * 6.7) / radius + phase * 2);
    p.setXYZ(i, x * k, y * k * squash, z * k);
  }
  g.computeVertexNormals();
  return g;
}
function oak() {
  const f = new Forge("oak", 1.6),
    random = seeded(7);
  plantingBed(f);
  f.lathe(
    "bark",
    [
      [0.46, 0.28],
      [0.33, 0.45],
      [0.26, 0.9],
      [0.23, 1.5],
      [0.2, 2.05],
    ],
    {},
    12,
  );
  const limbs: Vec3[] = [
    [0.5, 0.6, 0.2],
    [-0.55, 0.7, -0.15],
    [0.05, 0.75, -0.55],
    [-0.1, 0.6, 0.5],
  ];
  for (const [x, y, z] of limbs) {
    const length = Math.hypot(x, y, z);
    f.frame(
      {
        at: [0, 1.75, 0],
        rot: [Math.atan2(z, y), 0, -Math.atan2(x, Math.hypot(y, z))],
      },
      () =>
        f.cyl("bark", 0.06, 0.12, length, { at: [0, length / 2, 0] }, 7, true),
    );
  }
  const crowns: [number, number, number, number][] = [
    [0, 2.7, 0, 0.72],
    [0.47, 2.42, 0.17, 0.5],
    [-0.48, 2.5, -0.1, 0.5],
    [0.07, 2.5, -0.48, 0.48],
    [-0.1, 2.42, 0.47, 0.48],
    [0.36, 2.82, -0.3, 0.42],
    [-0.34, 2.88, 0.3, 0.42],
  ];
  for (const [x, y, z, r] of crowns)
    f.add("foliage-oak", lump(r, 2, random, 0.82), {
      at: [x, y, z],
      rot: [random(), random() * 6, random()],
    });
  return f.build();
}
function pine() {
  const f = new Forge("pine", 1.6),
    random = seeded(19);
  plantingBed(f);
  f.cyl("bark", 0.07, 0.2, 3.3, { at: [0, 1.9, 0] }, 9, true);
  f.lathe(
    "bark",
    [
      [0.36, 0.28],
      [0.24, 0.42],
      [0.2, 0.7],
    ],
    {},
    9,
  );
  const tiers = 5;
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1),
      radius = 0.94 - t * 0.62,
      height = 0.74 - t * 0.16,
      sides = 11;
    const g = new THREE.ConeGeometry(radius, height, sides, 2, true);
    const p = g.attributes.position;
    const offsets = Array.from({ length: sides + 1 }, () => [
      0.84 + random() * 0.32,
      (random() - 0.5) * 0.16,
    ]);
    offsets[sides] = offsets[0];
    for (let k = 0; k < p.count; k++) {
      const y = p.getY(k);
      if (y > height / 2 - 1e-3) continue;
      const column = k % (sides + 1),
        [reach, drop] = offsets[column];
      const lower = y < -height / 2 + 1e-3 ? 1 : 0.55;
      p.setXYZ(
        k,
        p.getX(k) * (1 + (reach - 1) * lower),
        y + drop * lower - (lower === 1 ? 0.1 : 0),
        p.getZ(k) * (1 + (reach - 1) * lower),
      );
    }
    g.computeVertexNormals();
    f.add("foliage-pine", g, {
      at: [0, 1.22 + t * 1.98, 0],
      rot: [0, random() * 6, 0],
    });
  }
  return f.build();
}
function logs() {
  const f = new Forge("logs", 1.6),
    random = seeded(3);
  const r = 0.31,
    rows: [number, number][] = [
      [-0.63, r],
      [0, r],
      [0.63, r],
      [-0.315, r + 0.545],
      [0.315, r + 0.545],
      [0, r + 1.09],
    ];
  for (const [x, y] of rows) {
    const radius = r - random() * 0.035,
      length = 1.86 + random() * 0.1,
      slide = (random() - 0.5) * 0.08;
    f.frame(
      { at: [x, y - (r - radius), slide], rot: [PI / 2, random() * 6, 0] },
      () => {
        f.cyl(
          "bark",
          radius,
          radius * (0.93 + random() * 0.07),
          length,
          {},
          14,
          true,
        );
        for (const end of [-1, 1]) {
          const cap = new THREE.CircleGeometry(radius * 0.985, 14);
          f.add(
            "endgrain",
            cap,
            { at: [0, (end * length) / 2, 0], rot: [(-end * PI) / 2, 0, 0] },
            true,
          );
        }
      },
    );
  }
  for (const x of [-0.96, 0.96])
    for (const z of [-0.55, 0.55]) {
      f.box("planks-dark", [0.1, 1.25, 0.12], { at: [x, 0.625, z] }, 0.012);
    }
  for (const z of [-0.55, 0.55])
    f.box("planks-dark", [2.0, 0.09, 0.1], { at: [0, 0.045, z + 0.11] }, 0.01);
  return f.build();
}

export const obstacles: Record<string, () => THREE.Group> = {
  crate,
  "built-crate": builtCrate,
  pallet,
  drum,
  bags,
  hesco,
  barricade,
  press,
  hopper,
  valve,
  "robot-arm": robotArm,
  oak,
  pine,
  logs,
};
