import type * as THREE from "three";
import { Forge } from "./kit";

/**
 * Field equipment. Each model stands upright on y = 0 and is about one unit
 * tall; the game scales pickups and held items from their bounds.
 */
const PI = Math.PI;

/** Safety lever: a flat strip over the fuze that follows the body downwards. */
function lever(
  f: Forge,
  top: number,
  reach: number,
  drop: number,
  lean: number,
) {
  f.box(
    "steel",
    [reach + 0.07, 0.022, 0.1],
    { at: [reach / 2 - 0.02, top, 0] },
    0.008,
  );
  f.frame({ at: [reach + 0.012, top, 0], rot: [0, 0, lean] }, () =>
    f.box("steel", [0.022, drop, 0.095], { at: [0, -drop / 2, 0] }, 0.008),
  );
}
function pullRing(f: Forge, y: number, x: number) {
  f.cyl(
    "steel-dark",
    0.012,
    0.012,
    0.2,
    { at: [x + 0.1, y, 0], rot: [0, 0, PI / 2] },
    6,
  );
  f.torus(
    "steel",
    0.085,
    0.011,
    { at: [x - 0.08, y - 0.03, 0], rot: [0, 0.35, 0] },
    18,
  );
}

function grenade() {
  const f = new Forge("grenade", 1);
  f.sphere("paint-olive", 0.32, { at: [0, 0.34, 0], scale: [1, 1.06, 1] }, 22);
  f.torus(
    "paint-olive",
    0.32,
    0.014,
    { at: [0, 0.34, 0], rot: [PI / 2, 0, 0] },
    28,
  );
  f.cyl("paint-olive", 0.15, 0.19, 0.07, { at: [0, 0.685, 0] }, 16);
  f.cyl("steel-dark", 0.115, 0.125, 0.09, { at: [0, 0.76, 0] }, 14);
  f.cyl("steel", 0.095, 0.095, 0.15, { at: [0, 0.87, 0] }, 14);
  f.box("steel-dark", [0.2, 0.05, 0.13], { at: [0, 0.955, 0] }, 0.015);
  lever(f, 0.99, 0.185, 0.56, 0.21);
  pullRing(f, 0.9, -0.16);
  f.cyl("paint-yellow", 0.176, 0.196, 0.022, { at: [0, 0.662, 0] }, 16, true);
  return f.build();
}

/** Incendiary bottle: a glass body with a paper label, a cork and a rag wick. */
function molotov() {
  const f = new Forge("molotov", 1);
  const r = 0.2;
  f.lathe(
    "glass",
    [
      [0, 0],
      [r - 0.03, 0],
      [r, 0.03],
      [r, 0.46],
      [r - 0.03, 0.56],
      [0.075, 0.68],
      [0.07, 0.86],
      [0.085, 0.87],
      [0.085, 0.9],
      [0, 0.9],
    ],
    {},
    22,
  );
  f.cyl("paint-ivory", r + 0.004, r + 0.004, 0.2, { at: [0, 0.27, 0] }, 22, true);
  f.cyl("paint-red", r + 0.006, r + 0.006, 0.035, { at: [0, 0.27, 0] }, 22, true);
  f.cyl("endgrain", 0.062, 0.07, 0.06, { at: [0, 0.92, 0] }, 12);
  // The rag: stuffed through the cork, then flopping over to one side.
  f.cyl("burlap", 0.04, 0.045, 0.12, { at: [0, 1, 0] }, 8);
  f.frame({ at: [0, 1.05, 0], rot: [0, 0, -0.9] }, () =>
    f.box("burlap", [0.07, 0.2, 0.03], { at: [0, 0.09, 0] }, 0.01),
  );
  return f.build();
}

function shield() {
  const f = new Forge("shield", 1);
  const radius = 0.78,
    thick = 0.045,
    half = 0.66,
    height = 1.12,
    steps = 10;
  const arc = (r: number, flip: boolean) =>
    Array.from({ length: steps + 1 }, (_, i) => {
      const a = (flip ? 1 - i / steps : i / steps) * half * 2 - half;
      return [Math.sin(a) * r, Math.cos(a) * r - radius] as const;
    });
  // Curved plate: an arc outline extruded upwards, bulging towards +Z.
  const plate = (
    material: string,
    outer: number,
    depth: number,
    y: number,
    tall: number,
    grow = 0,
  ) =>
    f.extrude(
      material,
      [...arc(outer + grow, false), ...arc(outer - depth - grow, true)],
      tall,
      { at: [0, y, 0], rot: [-PI / 2, 0, PI] },
      0.012,
    );
  plate("paint-graphite", radius, thick, height / 2 + 0.02, height);
  plate("rubber", radius, thick, 0.03, 0.06, 0.012);
  plate("rubber", radius, thick, height + 0.01, 0.06, 0.012);
  const face = 0.0;
  f.box("steel-dark", [0.5, 0.2, 0.05], { at: [0, 0.86, face - 0.006] }, 0.015);
  f.box("glass", [0.42, 0.13, 0.05], { at: [0, 0.86, face + 0.004] }, 0.01);
  f.box(
    "paint-teal",
    [0.34, 0.035, 0.02],
    { at: [0, 0.66, face - 0.004] },
    0.004,
  );
  for (const x of [-0.36, 0.36])
    for (const y of [0.16, 1.0]) {
      const z = Math.cos(Math.asin(x / radius)) * radius - radius;
      f.sphere("steel", 0.022, { at: [x, y, z + 0.004] }, 8);
    }
  // Grip and forearm strap on the inside.
  const back = -thick;
  for (const y of [0.42, 0.72])
    f.box(
      "steel-dark",
      [0.05, 0.05, 0.1],
      { at: [0.06, y, back - 0.05] },
      0.01,
    );
  f.box("rubber", [0.06, 0.4, 0.05], { at: [0.06, 0.57, back - 0.11] }, 0.02);
  f.box("rubber", [0.3, 0.07, 0.02], { at: [-0.14, 0.5, back - 0.03] }, 0.008);
  return f.build();
}

function knife() {
  const f = new Forge("knife", 0.7);
  const guard = 0.47;
  f.extrude(
    "steel-blade",
    [
      [-0.062, guard],
      [0.062, guard],
      [0.066, guard + 0.5],
      [0.03, guard + 0.63],
      [-0.012, guard + 0.7],
      [-0.03, guard + 0.56],
      [-0.062, guard + 0.5],
    ],
    0.024,
    {},
    0.011,
  );
  f.box(
    "steel-dark",
    [0.25, 0.04, 0.075],
    { at: [0, guard - 0.012, 0] },
    0.012,
  );
  f.box("rubber", [0.088, 0.4, 0.062], { at: [0, guard - 0.23, 0] }, 0.026);
  for (let i = 0; i < 5; i++)
    f.box(
      "rubber",
      [0.1, 0.03, 0.074],
      { at: [0, guard - 0.08 - i * 0.075, 0] },
      0.012,
    );
  f.box("steel-dark", [0.105, 0.06, 0.078], { at: [0, 0.03, 0] }, 0.016);
  f.cyl(
    "steel",
    0.016,
    0.016,
    0.09,
    { at: [0, 0.03, 0], rot: [PI / 2, 0, 0] },
    8,
  );
  return f.build();
}

/** Carried form of the buildable crate: the built crate at hand size, with a rope carry loop. */
function crate() {
  const f = new Forge("crate", 1);
  f.box("planks", [0.84, 0.76, 0.84], { at: [0, 0.42, 0] }, 0.01);
  for (let k = 0; k < 4; k++)
    f.frame({ rot: [0, (k * PI) / 2, 0] }, () => {
      const z = 0.432;
      for (const y of [0.09, 0.75]) f.box("planks-dark", [0.9, 0.1, 0.035], { at: [0, y, z] }, 0.008);
      for (const x of [-0.4, 0.4]) f.box("planks-dark", [0.1, 0.56, 0.035], { at: [x, 0.42, z] }, 0.008);
      f.box("paint-olive", [0.48, 0.48, 0.03], { at: [0, 0.42, 0.44] }, 0.008);
      f.box("steel", [0.11, 0.14, 0.08], { at: [0.415, 0.76, 0.415] }, 0.006);
      f.box("steel", [0.11, 0.14, 0.08], { at: [0.415, 0.08, 0.415] }, 0.006);
    });
  f.box("planks-dark", [0.92, 0.045, 0.92], { at: [0, 0.822, 0] }, 0.01);
  for (const x of [-0.26, 0.26]) f.box("steel", [0.05, 0.01, 0.93], { at: [x, 0.848, 0] }, 0);
  f.torus("burlap", 0.16, 0.022, { at: [0, 0.85, 0], rot: [0, PI / 2, 0] }, 14, PI);
  return f.build();
}

export const items: Record<string, () => THREE.Group> = {
  grenade,
  molotov,
  shield,
  knife,
  crate,
};
