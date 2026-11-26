import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { Forge, seeded, type Vec3 } from "./kit";

/**
 * Rainforest set: destructible obstacles, permanent-wall variants and the scenery that stands
 * outside the grid. Authored in world units: a tile is 2.4 wide and models stand on y = 0.
 */
const PI = Math.PI;

/**
 * A leaf blade that leaves the origin along +X, starts at `rise` radians above the horizon and
 * bends down by `droop` radians over its length. U runs across the blade, V along it.
 */
function blade(length: number, width: number, rise: number, droop: number, segments = 6, fold = 0.18) {
  const positions: number[] = [],
    uvs: number[] = [],
    index: number[] = [];
  let x = 0,
    y = 0;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments,
      angle = rise - droop * t;
    if (i) {
      x += (Math.cos(angle) * length) / segments;
      y += (Math.sin(angle) * length) / segments;
    }
    const half = (width / 2) * Math.pow(Math.sin(PI * (0.06 + 0.94 * t) * 0.97), 0.75);
    // The midrib sits below the edges, which gives the blade a shallow V section.
    const lift = half * fold;
    const nx = -Math.sin(angle),
      ny = Math.cos(angle);
    positions.push(x + nx * lift, y + ny * lift, -half, x, y, 0, x + nx * lift, y + ny * lift, half);
    uvs.push(0, t * (length / 1.2), 0.5, t * (length / 1.2), 1, t * (length / 1.2));
    if (i < segments) {
      const a = i * 3;
      index.push(a, a + 1, a + 3, a + 1, a + 4, a + 3, a + 1, a + 2, a + 4, a + 2, a + 5, a + 4);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/** A rosette of blades around the Y axis. */
function rosette(
  f: Forge,
  material: string,
  random: () => number,
  count: number,
  spec: { length: number; width: number; rise: number; droop: number; segments?: number },
  at: Vec3 = [0, 0, 0],
) {
  for (let i = 0; i < count; i++) {
    const turn = (i / count) * PI * 2 + (random() - 0.5) * 0.5,
      scale = 0.82 + random() * 0.36;
    f.add(
      material,
      blade(
        spec.length * scale,
        spec.width * (0.85 + random() * 0.3),
        spec.rise + (random() - 0.5) * 0.35,
        spec.droop + (random() - 0.5) * 0.4,
        spec.segments ?? 6,
      ),
      { at, rot: [(random() - 0.5) * 0.5, turn, 0] },
      true,
    );
  }
}

/** An irregular rock. `detail` 1 gives a faceted boulder, 2 a rounder one. */
function rock(radius: number, random: () => number, detail = 1, squash = 0.8) {
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
      0.2 * Math.sin((x * 3.3) / radius + phase) * Math.cos((z * 2.9) / radius - phase) +
      0.13 * Math.sin((y * 4.7) / radius + phase * 2) +
      (random() - 0.5) * 0.12;
    p.setXYZ(i, x * k, y * k * squash, z * k);
  }
  g.computeVertexNormals();
  return g;
}

function mound(f: Forge, random: () => number, radius = 0.98, height = 0.3) {
  f.add("moss", rock(radius, random, 2, height / radius), { at: [0, 0.02, 0] });
}

// --- Destructible obstacles -------------------------------------------------------------------

function fern() {
  const f = new Forge("fern", 1.6),
    random = seeded(31);
  mound(f, random, 0.95, 0.34);
  rosette(f, "leaf", random, 9, { length: 1.25, width: 0.5, rise: 0.75, droop: 1.5 }, [0, 0.2, 0]);
  rosette(f, "leaf-dark", random, 7, { length: 1.05, width: 0.42, rise: 1.15, droop: 1.2 }, [0, 0.28, 0]);
  rosette(f, "leaf", random, 4, { length: 0.8, width: 0.3, rise: 1.4, droop: 0.7 }, [0, 0.34, 0]);
  for (const [x, z, r] of [
    [0.62, 0.5, 0.2],
    [-0.66, -0.4, 0.24],
  ] as const)
    f.add("moss-rock", rock(r, random), { at: [x, r * 0.5, z] });
  return f.build();
}

function banana() {
  const f = new Forge("banana", 1.6),
    random = seeded(53);
  mound(f, random, 0.9, 0.3);
  // A cluster of three stems, the middle one the tallest.
  for (const [x, z, h, lean] of [
    [0, 0, 2.1, 0],
    [0.42, 0.18, 1.45, 0.16],
    [-0.36, -0.3, 1.2, -0.2],
  ] as const) {
    f.frame({ at: [x, 0.12, z], rot: [lean * 0.6, random() * 6, lean] }, () => {
      f.lathe(
        "leaf-dark",
        [
          [0.17, 0],
          [0.14, h * 0.5],
          [0.09, h],
        ],
        {},
        8,
      );
      rosette(
        f,
        "leaf",
        random,
        h > 2 ? 7 : 5,
        { length: 1.15 + h * 0.18, width: 0.62, rise: 1.0, droop: 1.55, segments: 7 },
        [0, h - 0.05, 0],
      );
    });
  }
  return f.build();
}

function boulder() {
  const f = new Forge("boulder", 1.8),
    random = seeded(11);
  f.add("moss-rock", rock(0.86, random, 1, 0.82), { at: [-0.12, 0.62, 0.06], rot: [0, 0.4, 0] });
  f.add("moss-rock", rock(0.52, random, 1, 0.8), { at: [0.6, 0.36, 0.44], rot: [0, 1.9, 0] });
  f.add("moss-rock", rock(0.42, random, 1, 0.75), { at: [0.5, 0.28, -0.56], rot: [0, 3.1, 0] });
  f.add("moss-rock", rock(0.3, random, 1, 0.7), { at: [-0.7, 0.2, -0.6] });
  f.add("moss", rock(0.5, random, 2, 0.3), { at: [-0.2, 1.24, 0.05] });
  rosette(f, "leaf-dark", random, 5, { length: 0.6, width: 0.24, rise: 0.9, droop: 1.3, segments: 4 }, [
    -0.62,
    0.1,
    0.62,
  ]);
  return f.build();
}

function fallenLog() {
  const f = new Forge("fallen-log", 1.6),
    random = seeded(23);
  const r = 0.56,
    length = 2.06;
  f.frame({ at: [0, r - 0.04, 0], rot: [0, 0, PI / 2] }, () => {
    f.cyl("jungle-bark", r, r * 0.9, length, {}, 14, true);
    for (const end of [-1, 1])
      f.add(
        "endgrain",
        new THREE.CircleGeometry(r * (end > 0 ? 0.98 : 0.88), 14),
        { at: [0, (end * length) / 2, 0], rot: [(-end * PI) / 2, 0, 0] },
        true,
      );
    // A snapped limb.
    f.cyl("jungle-bark", 0.1, 0.17, 0.7, { at: [0.3, 0.3, 0.5], rot: [1.0, 0, -0.5] }, 8);
  });
  f.add("moss", rock(0.62, random, 2, 0.3), { at: [-0.3, r * 2 - 0.16, 0], scale: [1.5, 1, 0.8] });
  f.add("moss", rock(0.4, random, 2, 0.3), { at: [0.62, r * 2 - 0.14, 0.1] });
  // Bracket fungi on the flank.
  for (let i = 0; i < 4; i++)
    f.cyl(
      "endgrain",
      0.16 - i * 0.015,
      0.2 - i * 0.015,
      0.05,
      { at: [-0.7 + i * 0.42, 0.42 + (i % 2) * 0.22, r * 0.93], rot: [0.25, 0, 0] },
      8,
    );
  rosette(f, "leaf", random, 6, { length: 0.75, width: 0.3, rise: 0.9, droop: 1.3, segments: 5 }, [
    0.5,
    0.05,
    -0.78,
  ]);
  for (const x of [-0.8, 0.84]) f.add("moss-rock", rock(0.24, random), { at: [x, 0.12, 0.8] });
  return f.build();
}

function stoneBlock(f: Forge, size: Vec3, at: Vec3, turn = 0) {
  f.box("ruin-stone", size, { at, rot: [0, turn, 0] }, 0.035);
}

function ruinPillar() {
  const f = new Forge("ruin-pillar", 1.6),
    random = seeded(41);
  stoneBlock(f, [1.86, 0.34, 1.86], [0, 0.17, 0]);
  stoneBlock(f, [1.5, 0.26, 1.5], [0, 0.47, 0], 0.03);
  // Drums of a broken column, each slightly off axis.
  let y = 0.6;
  for (const [radius, height] of [
    [0.6, 0.56],
    [0.57, 0.5],
    [0.55, 0.42],
  ] as const) {
    f.cyl("ruin-stone", radius * 0.97, radius, height, {
      at: [(random() - 0.5) * 0.06, y + height / 2, (random() - 0.5) * 0.06],
      rot: [0, random() * 6, 0],
    });
    y += height + 0.015;
  }
  // The snapped top.
  f.cyl("ruin-stone", 0.3, 0.54, 0.3, { at: [0.08, y + 0.13, -0.05], rot: [0.12, 0, -0.1] }, 9);
  stoneBlock(f, [0.62, 0.4, 0.5], [0.66, 0.84, 0.62], 0.5);
  f.add("moss", rock(0.5, random, 2, 0.26), { at: [-0.5, 0.62, 0.5] });
  f.add("moss", rock(0.36, random, 2, 0.3), { at: [0.1, y + 0.2, 0] });
  rosette(f, "leaf-dark", random, 5, { length: 0.6, width: 0.22, rise: 1.0, droop: 1.3, segments: 4 }, [
    -0.62,
    0.6,
    -0.56,
  ]);
  return f.build();
}

function idol() {
  const f = new Forge("idol", 1.6),
    random = seeded(67);
  stoneBlock(f, [1.9, 0.3, 1.7], [0, 0.15, 0]);
  // A weathered stone head: stacked masses with a brow, nose and mouth cut as blocks.
  stoneBlock(f, [1.5, 1.0, 1.3], [0, 0.8, 0]);
  stoneBlock(f, [1.62, 0.5, 1.4], [0, 1.52, 0]);
  stoneBlock(f, [1.3, 0.3, 1.16], [0, 1.9, 0]);
  stoneBlock(f, [1.36, 0.16, 0.2], [0, 1.4, 0.72]);
  stoneBlock(f, [0.3, 0.56, 0.3], [0, 1.02, 0.7]);
  stoneBlock(f, [0.8, 0.12, 0.14], [0, 0.56, 0.68]);
  for (const x of [-0.44, 0.44]) stoneBlock(f, [0.32, 0.14, 0.12], [x, 1.2, 0.66]);
  for (const x of [-0.86, 0.86]) stoneBlock(f, [0.2, 0.8, 0.5], [x, 0.98, 0]);
  f.add("moss", rock(0.6, random, 2, 0.24), { at: [-0.2, 2.03, -0.1], scale: [1.2, 1, 1] });
  f.add("moss", rock(0.4, random, 2, 0.4), { at: [0.72, 0.4, 0.62] });
  rosette(f, "leaf", random, 5, { length: 0.7, width: 0.28, rise: 0.9, droop: 1.4, segments: 4 }, [
    -0.78,
    0.3,
    0.66,
  ]);
  return f.build();
}

// --- Permanent walls ---------------------------------------------------------------------------

/** Trunk with plank buttresses, the signature of a rainforest emergent. */
function buttressTrunk(f: Forge, random: () => number, radius: number, height: number, reach: number) {
  f.lathe(
    "jungle-bark",
    [
      [radius * 1.5, 0],
      [radius * 1.12, height * 0.14],
      [radius, height * 0.3],
      [radius * 0.9, height * 0.7],
      [radius * 0.8, height],
    ],
    {},
    12,
  );
  const fins = 5;
  for (let i = 0; i < fins; i++) {
    const turn = (i / fins) * PI * 2 + (random() - 0.5) * 0.4,
      out = reach * (0.82 + random() * 0.3),
      up = height * (0.34 + random() * 0.14);
    f.extrude(
      "jungle-bark",
      [
        [radius * 0.5, 0],
        [out, 0],
        [out * 0.72, up * 0.16],
        [radius * 0.9, up],
        [radius * 0.5, up],
      ],
      0.16,
      { rot: [0, turn, 0] },
      0.03,
    );
  }
}

function jungleTree() {
  const f = new Forge("jungle-tree", 1.8),
    random = seeded(71);
  f.add("moss", rock(1.06, random, 2, 0.16), { at: [0, 0.02, 0] });
  buttressTrunk(f, random, 0.46, 3.1, 1.1);
  for (const [x, y, z] of [
    [0.55, 0.5, 0.2],
    [-0.5, 0.55, -0.3],
    [0.1, 0.6, -0.55],
  ] as const) {
    const length = Math.hypot(x, y, z) * 1.2;
    f.frame({ at: [0, 2.85, 0], rot: [Math.atan2(z, y), 0, -Math.atan2(x, Math.hypot(y, z))] }, () =>
      f.cyl("jungle-bark", 0.08, 0.16, length, { at: [0, length / 2, 0] }, 7, true),
    );
  }
  const crowns: [number, number, number, number][] = [
    [0, 3.8, 0, 0.8],
    [0.55, 3.42, 0.2, 0.6],
    [-0.52, 3.5, -0.26, 0.62],
    [0.1, 3.56, -0.56, 0.56],
    [-0.14, 3.4, 0.56, 0.58],
    [0.3, 4.2, 0.1, 0.5],
  ];
  for (const [x, y, z, r] of crowns)
    f.add("foliage-jungle", rock(r, random, 2, 0.9), { at: [x, y, z], rot: [0, random() * 6, 0] });
  // Hanging vines.
  for (let i = 0; i < 5; i++) {
    const a = random() * PI * 2,
      d = 0.5 + random() * 0.4,
      length = 0.8 + random() * 0.9;
    f.cyl("leaf-dark", 0.02, 0.025, length, { at: [Math.cos(a) * d, 3.2 - length / 2, Math.sin(a) * d] }, 5, true);
  }
  rosette(f, "leaf", random, 6, { length: 0.7, width: 0.26, rise: 0.9, droop: 1.3, segments: 4 }, [
    0.74,
    0.08,
    0.7,
  ]);
  return f.build();
}

function jungleRock() {
  const f = new Forge("jungle-rock", 2),
    random = seeded(83);
  f.add("moss-rock", rock(1.12, random, 1, 1.05), { at: [0, 1.0, 0], rot: [0, 0.6, 0] });
  f.add("moss-rock", rock(0.7, random, 1, 0.9), { at: [0.6, 0.5, 0.62], rot: [0, 2.2, 0] });
  f.add("moss-rock", rock(0.66, random, 1, 0.9), { at: [-0.66, 0.46, -0.56], rot: [0, 4.0, 0] });
  f.add("moss-rock", rock(0.5, random, 1, 0.8), { at: [-0.62, 0.36, 0.72] });
  f.add("moss-rock", rock(0.5, random, 1, 0.8), { at: [0.7, 0.36, -0.7] });
  f.add("moss", rock(0.72, random, 2, 0.22), { at: [0, 2.12, 0] });
  rosette(f, "leaf-dark", random, 6, { length: 0.6, width: 0.24, rise: 1.0, droop: 1.3, segments: 4 }, [
    0.1,
    2.1,
    0.1,
  ]);
  return f.build();
}

// --- Scenery outside the grid ------------------------------------------------------------------

function canopyTree(detail: boolean) {
  const f = new Forge(detail ? "canopy-tree" : "canopy-tree-far", 2.2),
    random = seeded(97);
  const height = 11;
  if (detail) buttressTrunk(f, random, 0.62, height, 2.1);
  else f.cyl("jungle-bark", 0.5, 0.86, height, { at: [0, height / 2, 0] }, 6, true);
  const limbs: Vec3[] = [
    [2.2, 1.6, 0.6],
    [-2.0, 1.9, -0.9],
    [0.4, 1.8, -2.2],
    [-0.6, 1.5, 2.1],
  ];
  if (detail)
    for (const [x, y, z] of limbs) {
      const length = Math.hypot(x, y, z);
      f.frame({ at: [0, height - 1.6, 0], rot: [Math.atan2(z, y), 0, -Math.atan2(x, Math.hypot(y, z))] }, () =>
        f.cyl("jungle-bark", 0.14, 0.3, length, { at: [0, length / 2, 0] }, 7, true),
      );
    }
  // A wide, layered umbrella crown: one broad mass with smaller ones around and above it.
  const crowns: [number, number, number, number][] = [[0, height + 1.2, 0, 3.4]];
  const outer = detail ? 7 : 5;
  for (let i = 0; i < outer; i++) {
    const a = (i / outer) * PI * 2 + random() * 0.5,
      d = 3 + random() * 1.6;
    crowns.push([Math.cos(a) * d, height + 0.2 + random() * 1.1, Math.sin(a) * d, 1.7 + random() * 0.9]);
  }
  for (let i = 0; i < (detail ? 3 : 2); i++) {
    const a = random() * PI * 2,
      d = 1 + random() * 1.4;
    crowns.push([Math.cos(a) * d, height + 2.6 + random() * 0.8, Math.sin(a) * d, 1.5 + random() * 0.6]);
  }
  for (const [x, y, z, r] of crowns)
    f.add("foliage-jungle", rock(r, random, detail ? 2 : 1, 0.72), {
      at: [x, y, z],
      rot: [0, random() * 6, 0],
    });
  if (detail)
    for (let i = 0; i < 7; i++) {
      const a = random() * PI * 2,
        d = 1.2 + random() * 2,
        length = 2 + random() * 3.5;
      f.cyl(
        "leaf-dark",
        0.03,
        0.04,
        length,
        { at: [Math.cos(a) * d, height - 0.2 - length / 2, Math.sin(a) * d] },
        5,
        true,
      );
    }
  return f.build();
}

function undergrowth() {
  const f = new Forge("undergrowth", 1.6),
    random = seeded(101);
  rosette(f, "leaf", random, 8, { length: 1.5, width: 0.58, rise: 0.8, droop: 1.5 }, [0, 0.05, 0]);
  rosette(f, "leaf-dark", random, 6, { length: 1.2, width: 0.5, rise: 1.2, droop: 1.1 }, [0, 0.1, 0]);
  return f.build();
}

function palmTree() {
  const f = new Forge("palm-tree", 1.8),
    random = seeded(109);
  const height = 6.4;
  // The trunk leans, in three straight sections.
  let x = 0,
    y = 0;
  for (let i = 0; i < 4; i++) {
    const lean = 0.05 + i * 0.05,
      section = height / 4;
    f.frame({ at: [x, y, 0], rot: [0, 0, -lean] }, () =>
      f.cyl("jungle-bark", 0.17 - i * 0.015, 0.2 - i * 0.015, section + 0.04, { at: [0, section / 2, 0] }, 8, true),
    );
    x += Math.sin(lean) * section;
    y += Math.cos(lean) * section;
  }
  rosette(f, "leaf", random, 11, { length: 2.9, width: 0.8, rise: 0.7, droop: 1.7, segments: 7 }, [x, y, 0]);
  rosette(f, "leaf-dark", random, 6, { length: 2.2, width: 0.66, rise: 1.2, droop: 1.3, segments: 6 }, [
    x,
    y + 0.05,
    0,
  ]);
  return f.build();
}

export const jungle: Record<string, () => THREE.Group> = {
  fern,
  banana,
  boulder,
  "fallen-log": fallenLog,
  "ruin-pillar": ruinPillar,
  idol,
  "jungle-tree": jungleTree,
  "jungle-rock": jungleRock,
  "canopy-tree": () => canopyTree(true),
  "canopy-tree-far": () => canopyTree(false),
  "palm-tree": palmTree,
  undergrowth,
};
