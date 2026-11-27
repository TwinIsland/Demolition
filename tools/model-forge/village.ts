import * as THREE from "three";
import { Forge, seeded, type Place, type Region } from "./kit";

/**
 * The Flatland starter village: houses, a shrine, gates and the stonework between them, plus the
 * things a blast can clear away. Authored in world units: a tile is 2.4 wide and models stand on
 * y = 0.
 *
 * Rule of the set, because the tutorial says it out loud: what is stone or plaster is permanent,
 * what is plain wood or straw can be blown up.
 *
 * A building covers several tiles and is exported cut into one piece per tile (`cell-<column>-<row>`
 * counted from its north-west corner), so the arena can take a tile away without the rest.
 */
const PI = Math.PI,
  TILE = 2.4;

/** Where each picture sits on the writing sheet: left, top, right, bottom as fractions. */
const WRITING = {
  notice: [0, 0, 1, 0.375],
  curtain: [0, 0.375, 0.5, 0.625],
  tablet: [0.5, 0.375, 0.75, 0.75],
  board: [0.75, 0.375, 1, 0.75],
  lantern: [0, 0.625, 0.5, 0.875],
} as const;
type Rect = readonly [number, number, number, number];

/** An upright picture facing +Z, showing `rect` of its texture the right way up. */
function picture(f: Forge, material: string, w: number, h: number, rect: Rect, place: Place) {
  const geometry = new THREE.PlaneGeometry(w, h),
    uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++)
    uv.setXY(
      i,
      rect[0] + uv.getX(i) * (rect[2] - rect[0]),
      rect[1] + (1 - uv.getY(i)) * (rect[3] - rect[1]),
    );
  f.add(material, geometry, place, true);
}

/** A stone kerb with gravel inside it: the foot of everything that is thinner than its tile. */
function plinth(f: Forge, size = 2.06, height = 0.2) {
  f.box("village-stone", [size, height, size], { at: [0, height / 2, 0] }, 0.03);
  f.box("village-cobble", [size - 0.3, 0.03, size - 0.3], { at: [0, height + 0.005, 0] }, 0);
}

/**
 * A gabled roof with its ridge along X, centred on the origin: two slopes that pass `plate` high
 * over the walls at z = +-`wall` and run on by `eave`.
 */
function gable(
  f: Forge,
  material: string,
  length: number,
  wall: number,
  plate: number,
  pitch: number,
  eave: number,
  thickness: number,
) {
  const span = wall + eave,
    slope = span / Math.cos(pitch),
    ridge = plate + wall * Math.tan(pitch);
  for (const side of [-1, 1]) {
    const y = ridge - (span / 2) * Math.tan(pitch) + thickness / 2 / Math.cos(pitch);
    f.box(material, [length, thickness, slope], { at: [0, y, (side * span) / 2], rot: [side * pitch, 0, 0] }, 0);
    // Bargeboards close the gable ends under the roof's edge.
    for (const end of [-1, 1])
      f.box(
        "village-cedar",
        [0.07, 0.2, slope],
        { at: [end * (length / 2 - 0.05), y - 0.14, (side * span) / 2], rot: [side * pitch, 0, 0] },
        0.01,
      );
    // A board along the eave, where the rafters end.
    f.box(
      "village-cedar",
      [length - 0.1, 0.1, 0.08],
      { at: [0, plate - eave * Math.tan(pitch) + 0.02, side * (span - 0.05)] },
      0.01,
    );
  }
  return ridge + thickness / Math.cos(pitch);
}

interface Shell {
  /** Half extents of the plastered walls. */
  wx: number;
  wz: number;
  /** Height of the sill and of the wall plate. */
  base: number;
  top: number;
}

/** Foundation, plaster walls and the timber frame that shows on them. The front looks along +Z. */
function shell(f: Forge, width: number, depth: number, wallHeight: number, base = 0.4): Shell {
  const fx = width / 2 - 0.13,
    fz = depth / 2 - 0.13,
    wx = fx - 0.1,
    wz = fz - 0.1,
    top = base + wallHeight;
  f.box("village-stone", [fx * 2, base, fz * 2], { at: [0, base / 2, 0] }, 0.03);
  f.box("village-plaster", [wx * 2, wallHeight, wz * 2], { at: [0, base + wallHeight / 2, 0] }, 0);
  const rails = [base + 0.08, top - 0.08, base + wallHeight * 0.58];
  for (const side of [-1, 1]) {
    for (const [index, y] of rails.entries()) {
      // The middle rail stays off the front, where doors and windows go.
      if (index < 2 || side < 0)
        f.box("village-cedar", [wx * 2 + 0.16, 0.15, 0.14], { at: [0, y, side * wz] }, 0.012);
      f.box("village-cedar", [0.14, 0.15, wz * 2 + 0.16], { at: [side * wx, y, 0] }, 0.012);
    }
    const along = Math.round((wx * 2) / 1.2),
      across = Math.round((wz * 2) / 1.2);
    for (let i = 0; i <= along; i++)
      f.box("village-cedar", [0.15, wallHeight, 0.15], {
        at: [-wx + (i * wx * 2) / along, base + wallHeight / 2, side * wz],
      }, 0.012);
    for (let i = 1; i < across; i++)
      f.box("village-cedar", [0.15, wallHeight, 0.15], {
        at: [side * wx, base + wallHeight / 2, -wz + (i * wz * 2) / across],
      }, 0.012);
  }
  return { wx, wz, base, top };
}

/** The plastered triangle under each end of a gable roof, with a post up its middle. */
function gableEnds(f: Forge, s: Shell, pitch: number) {
  const rise = s.wz * Math.tan(pitch);
  for (const end of [-1, 1]) {
    f.extrude(
      "village-plaster",
      [
        [-s.wz, 0],
        [s.wz, 0],
        [0, rise],
      ],
      0.1,
      { at: [end * s.wx, s.top, 0], rot: [0, PI / 2, 0] },
    );
    f.box("village-cedar", [0.16, rise * 0.92, 0.14], { at: [end * (s.wx + 0.02), s.top + rise * 0.46, 0] }, 0.012);
    f.box("village-cedar", [0.16, 0.13, s.wz * 1.05], { at: [end * (s.wx + 0.02), s.top + rise * 0.42, 0] }, 0.012);
  }
}

/** A paper screen in a cedar frame, on a wall that faces +Z at `z`. */
function screen(f: Forge, x: number, y: number, z: number, w: number, h: number) {
  picture(f, "village-shoji", w, h, [0, 0, 1, 1], { at: [x, y, z + 0.012] });
  for (const side of [-1, 1]) {
    f.box("village-cedar", [0.07, h + 0.14, 0.06], { at: [x + side * (w / 2 + 0.035), y, z + 0.02] }, 0.008);
    f.box("village-cedar", [w + 0.14, 0.07, 0.06], { at: [x, y + side * (h / 2 + 0.035), z + 0.02] }, 0.008);
  }
}

/** A boarded sliding door on a wall that faces +Z at `z`. */
function door(f: Forge, x: number, base: number, z: number, w = 1.05, h = 1.9) {
  f.box("planks", [w, h, 0.06], { at: [x, base + h / 2, z + 0.03] }, 0.008);
  f.box("village-cedar", [w + 0.2, 0.12, 0.1], { at: [x, base + h + 0.06, z + 0.04] }, 0.01);
  for (const side of [-1, 1])
    f.box("village-cedar", [0.1, h, 0.1], { at: [x + side * (w / 2 + 0.05), base + h / 2, z + 0.04] }, 0.01);
  f.box("village-stone", [w + 0.3, 0.16, 0.24], { at: [x, 0.08, z + 0.14] }, 0.03);
}

/** A red paper lantern hanging from `at`. */
function paperLantern(f: Forge, at: readonly [number, number, number]) {
  f.frame({ at }, () => {
    f.cyl("paint-graphite", 0.012, 0.012, 0.3, { at: [0, 0.15, 0] }, 5);
    f.lathe(
      "village-vermilion",
      [
        [0.09, 0],
        [0.2, -0.1],
        [0.23, -0.27],
        [0.2, -0.44],
        [0.09, -0.54],
      ],
      {},
      12,
    );
    f.cyl("paint-graphite", 0.1, 0.1, 0.05, { at: [0, 0, 0] }, 10);
    f.cyl("paint-graphite", 0.1, 0.1, 0.05, { at: [0, -0.55, 0] }, 10);
  });
}

/** Cuts a finished building into its tiles. `turn` is how the authored front (+Z) was turned. */
const cells = (columns: number, rows: number): Region[] => {
  const regions: Region[] = [];
  for (let row = 0; row < rows; row++)
    for (let column = 0; column < columns; column++)
      regions.push({
        name: `cell-${column}-${row}`,
        minX: column ? (column - columns / 2) * TILE : undefined,
        maxX: column < columns - 1 ? (column + 1 - columns / 2) * TILE : undefined,
        minZ: row ? (row - rows / 2) * TILE : undefined,
        maxZ: row < rows - 1 ? (row + 1 - rows / 2) * TILE : undefined,
      });
  return regions;
};
/** Turn about Y that points an authored front (+Z) south, north, east or west. */
const FACING = { s: 0, n: PI, e: PI / 2, w: -PI / 2 } as const;

/** A thatched farmhouse, three tiles by two. */
function farmhouse() {
  const f = new Forge("village-farmhouse"),
    pitch = 0.7;
  f.frame({ rot: [0, FACING.s, 0] }, () => {
    const s = shell(f, 3 * TILE, 2 * TILE, 2.0);
    gableEnds(f, s, pitch);
    const ridge = gable(f, "village-thatch", 3 * TILE + 0.5, s.wz, s.top + 0.04, pitch, 0.42, 0.3);
    // The ridge of a thatched roof is held down by a saddle of boards and crossed poles.
    f.box("village-cedar", [3 * TILE + 0.3, 0.12, 0.7], { at: [0, ridge - 0.13, 0] }, 0.02);
    for (let i = -3; i <= 3; i++)
      for (const side of [-1, 1])
        f.cyl("planks", 0.045, 0.045, 1.1, { at: [i * 1.05, ridge - 0.05, side * 0.2], rot: [side * 0.95, 0, 0] }, 6);
    door(f, -1.1, s.base, s.wz);
    screen(f, 1.3, s.base + 1.15, s.wz, 1.5, 1.05);
    screen(f, -2.75, s.base + 1.25, s.wz, 0.8, 0.8);
    // Firewood under the eave and a water butt by the door.
    for (let i = 0; i < 6; i++)
      f.cyl("endgrain", 0.085, 0.085, 0.5, { at: [2.5 + (i % 3) * 0.18, 0.5 + Math.floor(i / 3) * 0.17, s.wz + 0.3], rot: [PI / 2, 0, 0] }, 7);
    f.cyl("planks-dark", 0.26, 0.22, 0.62, { at: [-2.05, 0.71, s.wz + 0.26] }, 12);
  });
  return f.split(cells(3, 2));
}

/** The dojo: a long tiled hall with a wall of paper doors, four tiles by two. */
function dojo() {
  const f = new Forge("village-dojo"),
    pitch = 0.54;
  f.frame({ rot: [0, FACING.s, 0] }, () => {
    const s = shell(f, 4 * TILE, 2 * TILE, 2.3);
    gableEnds(f, s, pitch);
    const ridge = gable(f, "village-roof", 4 * TILE + 0.6, s.wz, s.top + 0.04, pitch, 0.42, 0.14);
    f.cyl("village-roof", 0.15, 0.15, 4 * TILE + 0.5, { at: [0, ridge, 0], rot: [0, 0, PI / 2] }, 8);
    for (const end of [-1, 1]) f.box("village-roof", [0.16, 0.42, 0.5], { at: [end * (2 * TILE + 0.24), ridge + 0.06, 0] }, 0.04);
    // Four paper doors side by side, and the name of the house on a board beside them.
    for (let i = 0; i < 4; i++) screen(f, -1.62 + i * 1.08, s.base + 1.02, s.wz, 0.94, 1.9);
    f.box("village-stone", [4.6, 0.18, 0.26], { at: [0, 0.09, s.wz + 0.15] }, 0.03);
    f.box("planks", [0.44, 1.5, 0.06], { at: [2.9, s.base + 1.2, s.wz + 0.09] }, 0.01);
    picture(f, "village-writing", 0.4, 1.46, WRITING.board, { at: [2.9, s.base + 1.2, s.wz + 0.125] });
    screen(f, -3.35, s.base + 1.3, s.wz, 0.9, 0.9);
    // A rack of practice staves under the eave.
    for (let i = 0; i < 4; i++)
      f.cyl("planks", 0.022, 0.022, 1.7, { at: [3.75 + i * 0.09, s.base + 0.87, s.wz + 0.13], rot: [-0.06, 0, 0] }, 6);
  });
  return f.split(cells(4, 2));
}

/** The skill shop: an open front under an awning, with a curtain over the counter. Three tiles by two. */
function shop() {
  const f = new Forge("village-shop"),
    pitch = 0.54;
  f.frame({ rot: [0, FACING.n, 0] }, () => {
    const s = shell(f, 3 * TILE, 2 * TILE, 2.3);
    gableEnds(f, s, pitch);
    const ridge = gable(f, "village-roof", 3 * TILE + 0.6, s.wz, s.top + 0.04, pitch, 0.3, 0.14);
    f.cyl("village-roof", 0.15, 0.15, 3 * TILE + 0.5, { at: [0, ridge, 0], rot: [0, 0, PI / 2] }, 8);
    // The shop front: a dark opening, the counter, and the curtain with the shop's name.
    f.box("paint-graphite", [3.0, 1.95, 0.05], { at: [0, s.base + 0.975, s.wz + 0.03] }, 0);
    f.box("planks", [3.0, 0.9, 0.3], { at: [0, s.base + 0.45, s.wz + 0.16] }, 0.015);
    f.box("planks-dark", [3.1, 0.06, 0.4], { at: [0, s.base + 0.93, s.wz + 0.17] }, 0.012);
    f.cyl("village-cedar", 0.03, 0.03, 3.1, { at: [0, s.base + 1.93, s.wz + 0.22], rot: [0, 0, PI / 2] }, 6);
    picture(f, "village-writing", 2.5, 0.7, WRITING.curtain, { at: [0, s.base + 1.56, s.wz + 0.23] });
    picture(f, "village-writing", 2.5, 0.7, WRITING.curtain, { at: [0, s.base + 1.56, s.wz + 0.21], rot: [0, PI, 0] });
    // Goods on the counter: jars and a stack of scrolls.
    for (const [x, r] of [[-1.1, 0.13], [-0.75, 0.1], [1.0, 0.12]] as const)
      f.lathe("village-clay", [[r * 0.7, 0], [r, r * 0.9], [r * 0.85, r * 2], [r * 0.5, r * 2.3]], { at: [x, s.base + 0.96, s.wz + 0.17] }, 10);
    for (let i = 0; i < 3; i++)
      f.cyl("paint-ivory", 0.035, 0.035, 0.34, { at: [0.2 + (i % 2) * 0.08, s.base + 1.0 + Math.floor(i / 2) * 0.065, s.wz + 0.17], rot: [0, 0, PI / 2] }, 6);
    // A lean-to awning over the counter.
    f.box("village-roof", [4.4, 0.1, 0.62], { at: [0, s.top - 0.2, s.wz + 0.24], rot: [0.3, 0, 0] }, 0);
    for (const side of [-1, 1]) {
      f.box("village-cedar", [0.1, 0.1, 0.5], { at: [side * 2.0, s.top - 0.35, s.wz + 0.2], rot: [0.3, 0, 0] }, 0.01);
      paperLantern(f, [side * 2.0, s.top - 0.72, s.wz + 0.36]);
    }
    screen(f, 2.75, s.base + 1.25, s.wz, 0.8, 0.8);
    screen(f, -2.75, s.base + 1.25, s.wz, 0.8, 0.8);
  });
  return f.split(cells(3, 2));
}

/** A small thatched cottage, two tiles by two. */
function cottage() {
  const f = new Forge("village-cottage"),
    pitch = 0.7;
  f.frame({ rot: [0, FACING.w, 0] }, () => {
    const s = shell(f, 2 * TILE, 2 * TILE, 2.0);
    gableEnds(f, s, pitch);
    const ridge = gable(f, "village-thatch", 2 * TILE + 0.5, s.wz, s.top + 0.04, pitch, 0.42, 0.3);
    f.box("village-cedar", [2 * TILE + 0.3, 0.12, 0.7], { at: [0, ridge - 0.13, 0] }, 0.02);
    for (let i = -2; i <= 2; i++)
      for (const side of [-1, 1])
        f.cyl("planks", 0.045, 0.045, 1.1, { at: [i * 1.0, ridge - 0.05, side * 0.2], rot: [side * 0.95, 0, 0] }, 6);
    door(f, -0.8, s.base, s.wz);
    screen(f, 0.95, s.base + 1.2, s.wz, 1.1, 0.95);
  });
  return f.split(cells(2, 2));
}

/** The shrine: a white hall with vermilion posts on a stone platform. Two tiles wide, three deep. */
function shrine() {
  const f = new Forge("village-shrine"),
    pitch = 0.6,
    width = 3 * TILE,
    depth = 2 * TILE,
    deck = 0.72;
  f.frame({ rot: [0, FACING.w, 0] }, () => {
    // The platform leaves a strip at the front for the steps.
    const px = width / 2 - 0.13,
      back = -depth / 2 + 0.13,
      front = depth / 2 - 0.75;
    f.box("village-stone", [px * 2, deck, front - back], { at: [0, deck / 2, (front + back) / 2] }, 0.03);
    for (let step = 0; step < 3; step++)
      f.box("village-stone", [2.6, deck - step * 0.24, 0.21], { at: [0, (deck - step * 0.24) / 2, front + 0.1 + step * 0.2] }, 0.02);
    // The hall stands back from the platform's edge and leaves a walk around it.
    const hx = px - 0.62,
      hBack = back + 0.3,
      hFront = front - 0.75,
      hz = (hFront - hBack) / 2,
      centre = (hFront + hBack) / 2,
      wall = 2.0,
      top = deck + wall;
    f.box("village-plaster", [hx * 2, wall, hz * 2], { at: [0, deck + wall / 2, centre] }, 0);
    for (const side of [-1, 1]) {
      for (const y of [deck + 0.08, top - 0.08]) {
        f.box("village-vermilion", [hx * 2 + 0.2, 0.16, 0.16], { at: [0, y, centre + side * hz] }, 0.012);
        f.box("village-vermilion", [0.16, 0.16, hz * 2 + 0.2], { at: [side * hx, y, centre] }, 0.012);
      }
      for (let i = 0; i <= 4; i++)
        f.cyl("village-vermilion", 0.1, 0.1, wall, { at: [-hx + (i * hx) / 2, deck + wall / 2, centre + side * hz] }, 10);
      f.cyl("village-vermilion", 0.1, 0.1, wall, { at: [side * hx, deck + wall / 2, centre] }, 10);
      // Porch posts at the head of the steps, and a railing along the walk.
      f.cyl("village-vermilion", 0.11, 0.11, top - deck + 0.1, { at: [side * 1.4, (top + deck) / 2, front - 0.14] }, 10);
      f.box("village-vermilion", [px - 1.5, 0.07, 0.07], { at: [side * (px + 1.5) / 2, deck + 0.62, front - 0.1] }, 0.01);
      f.box("village-vermilion", [px - 1.5, 0.06, 0.06], { at: [side * (px + 1.5) / 2, deck + 0.34, front - 0.1] }, 0.01);
      f.box("village-vermilion", [0.07, 0.07, front - back - 0.2], { at: [side * (px - 0.08), deck + 0.62, (front + back) / 2] }, 0.01);
      f.box("village-vermilion", [0.06, 0.06, front - back - 0.2], { at: [side * (px - 0.08), deck + 0.34, (front + back) / 2] }, 0.01);
      for (let i = 0; i < 4; i++)
        f.box("village-vermilion", [0.08, 0.7, 0.08], { at: [side * (px - 0.08), deck + 0.35, back + 0.15 + (i * (front - back - 0.3)) / 3] }, 0.01);
    }
    // Latticed double doors, the rope over them and its paper streamers.
    f.box("planks-dark", [1.9, 1.7, 0.06], { at: [0, deck + 0.95, hFront + 0.04] }, 0.01);
    for (let i = -3; i <= 3; i++) f.box("paint-yellow", [0.03, 1.6, 0.03], { at: [i * 0.27, deck + 0.95, hFront + 0.08] }, 0);
    for (let i = 0; i < 4; i++) f.box("paint-yellow", [1.84, 0.03, 0.03], { at: [0, deck + 0.3 + i * 0.44, hFront + 0.08] }, 0);
    f.cyl("burlap", 0.075, 0.075, 2.9, { at: [0, top - 0.42, front - 0.14], rot: [0, 0, PI / 2] }, 8);
    for (let i = -2; i <= 2; i++) {
      if (i % 2) f.cyl("burlap", 0.05, 0.02, 0.34, { at: [i * 0.55, top - 0.63, front - 0.14] }, 6);
      else
        for (let fold = 0; fold < 3; fold++)
          f.box("paint-ivory", [0.13, 0.13, 0.012], { at: [i * 0.55 + (fold % 2) * 0.05, top - 0.56 - fold * 0.12, front - 0.13] }, 0);
    }
    // The offering box at the head of the steps.
    f.box("planks", [1.0, 0.5, 0.5], { at: [0, deck + 0.25, front - 0.42] }, 0.02);
    for (let i = -3; i <= 3; i++) f.box("planks-dark", [0.04, 0.03, 0.46], { at: [i * 0.13, deck + 0.51, front - 0.42] }, 0);
    // The roof reaches forward over the porch.
    const ridge = gable(f, "village-roof", width + 0.7, depth / 2 - 0.2, top + 0.04, pitch, 0.5, 0.16);
    f.cyl("village-roof", 0.17, 0.17, width + 0.5, { at: [0, ridge, 0], rot: [0, 0, PI / 2] }, 8);
    const rise = (depth / 2 - 0.2) * Math.tan(pitch);
    for (const end of [-1, 1]) {
      f.extrude("village-plaster", [[-(depth / 2 - 0.2), 0], [depth / 2 - 0.2, 0], [0, rise]], 0.1, { at: [end * (hx + 0.3), top + 0.04, 0], rot: [0, PI / 2, 0] });
      // Forked finials stand over each gable; short logs lie across the ridge between them.
      for (const side of [-1, 1])
        f.box("village-cedar", [0.1, 1.5, 0.16], { at: [end * (width / 2 + 0.22), ridge + 0.32, side * 0.1], rot: [side * -0.62, 0, 0] }, 0.012);
    }
    for (let i = -3; i <= 3; i++) {
      f.cyl("village-cedar", 0.1, 0.1, 0.8, { at: [i * 0.86, ridge + 0.2, 0], rot: [PI / 2, 0, 0] }, 8);
      for (const side of [-1, 1]) f.cyl("paint-yellow", 0.105, 0.105, 0.03, { at: [i * 0.86, ridge + 0.2, side * 0.4], rot: [PI / 2, 0, 0] }, 8);
    }
    f.box("planks-dark", [0.56, 0.8, 0.06], { at: [0, top + 0.5, front - 0.1] }, 0.01);
    picture(f, "village-writing", 0.5, 0.75, WRITING.tablet, { at: [0, top + 0.5, front - 0.065] });
    f.cyl("village-vermilion", 0.09, 0.09, 3.0, { at: [0, top + 0.05, front - 0.14], rot: [0, 0, PI / 2] }, 8);
  });
  return f.split(cells(2, 3));
}

/** A torii over the tile between its two posts, cut down the middle into a half for each post. */
function torii() {
  const f = new Forge("village-torii");
  for (const side of [-1, 1]) {
    f.frame({ at: [side * TILE, 0, 0] }, () => {
      plinth(f, 1.9, 0.22);
      f.cyl("paint-graphite", 0.3, 0.33, 0.55, { at: [0, 0.49, 0] }, 14);
      f.cyl("village-vermilion", 0.2, 0.24, 4.0, { at: [0, 2.7, 0] }, 14);
    });
    // The top beam turns up at its ends.
    f.box("paint-graphite", [1.3, 0.16, 0.5], { at: [side * 3.3, 4.94, 0], rot: [0, 0, side * 0.14] }, 0.02);
    f.box("village-vermilion", [1.3, 0.24, 0.36], { at: [side * 3.25, 4.75, 0], rot: [0, 0, side * 0.14] }, 0.02);
    f.box("village-vermilion", [0.2, 0.3, 0.2], { at: [side * TILE, 4.25, 0] }, 0.012);
  }
  f.box("paint-graphite", [5.6, 0.16, 0.5], { at: [0, 4.86, 0] }, 0.02);
  f.box("village-vermilion", [5.5, 0.24, 0.36], { at: [0, 4.67, 0] }, 0.02);
  f.box("village-vermilion", [6.3, 0.26, 0.22], { at: [0, 3.95, 0] }, 0.02);
  f.box("planks-dark", [0.5, 0.52, 0.12], { at: [0, 4.31, 0] }, 0.012);
  for (const side of [-1, 1])
    picture(f, "village-writing", 0.34, 0.5, WRITING.tablet, { at: [0, 4.31, side * 0.065], rot: [0, side < 0 ? PI : 0, 0] });
  return f.split([
    { name: "post-0", maxX: 0 },
    { name: "post-1", minX: 0 },
  ]);
}

/** A stone lantern on its plinth: the pillars of the dojo yard and the corners of the plaza. */
function lantern() {
  const f = new Forge("village-lantern", 1.4);
  plinth(f);
  const hex = (r: number, h: number, y: number, top = r) => f.prism("village-stone", top, r, h, 6, { at: [0, y + h / 2, 0] });
  hex(0.56, 0.24, 0.2);
  hex(0.44, 0.12, 0.44, 0.34);
  f.cyl("village-stone", 0.19, 0.23, 0.95, { at: [0, 1.03, 0] }, 10);
  hex(0.3, 0.14, 1.5, 0.48);
  // The fire box: four stone corner posts around the light.
  f.prism("village-flame", 0.25, 0.25, 0.4, 4, { at: [0, 1.84, 0] });
  for (let i = 0; i < 4; i++) {
    const angle = (i * PI) / 2;
    f.box("village-stone", [0.14, 0.42, 0.14], {
      at: [Math.sin(angle) * 0.25, 1.85, Math.cos(angle) * 0.25],
      rot: [0, PI / 4, 0],
    }, 0.01);
  }
  f.prism("village-stone", 0.32, 0.36, 0.06, 6, { at: [0, 2.07, 0] });
  // The cap sweeps out wide and ends in a jewel.
  f.prism("village-stone", 0.14, 0.78, 0.34, 6, { at: [0, 2.27, 0] });
  f.prism("village-stone", 0.78, 0.74, 0.05, 6, { at: [0, 2.085, 0] });
  f.sphere("village-stone", 0.12, { at: [0, 2.52, 0], scale: [1, 1.25, 1] }, 10);
  for (const [x, z, r] of [[-0.78, 0.7, 0.2], [0.74, -0.76, 0.16], [0.82, 0.62, 0.12]] as const)
    f.sphere("moss", r, { at: [x, 0.2, z], scale: [1, 0.5, 1] }, 8);
  return f.build();
}

/** The fountain in the middle of the plaza: an eight-sided basin and a bowl that overflows into it. */
function fountain() {
  const f = new Forge("village-fountain", 1.6);
  f.prism("village-stone", 1.16, 1.19, 0.16, 8, { at: [0, 0.08, 0], rot: [0, PI / 8, 0] });
  // The basin wall: a ring of eight blocks.
  for (let i = 0; i < 8; i++) {
    const angle = (i * PI) / 4;
    f.box("village-stone", [0.92, 0.5, 0.24], { at: [Math.sin(angle) * 0.98, 0.4, Math.cos(angle) * 0.98], rot: [0, angle, 0] }, 0.03);
    f.box("village-stone", [0.98, 0.07, 0.32], { at: [Math.sin(angle) * 0.98, 0.68, Math.cos(angle) * 0.98], rot: [0, angle, 0] }, 0.02);
  }
  f.cyl("village-water", 0.9, 0.9, 0.04, { at: [0, 0.56, 0] }, 16);
  f.prism("village-stone", 0.26, 0.34, 0.5, 8, { at: [0, 0.4, 0] });
  f.cyl("village-stone", 0.15, 0.2, 0.62, { at: [0, 0.95, 0] }, 10);
  f.lathe("village-stone", [[0.14, 0], [0.5, 0.14], [0.62, 0.3], [0.56, 0.32], [0.44, 0.2], [0, 0.14]], { at: [0, 1.24, 0] }, 14);
  f.cyl("village-water", 0.52, 0.52, 0.02, { at: [0, 1.5, 0] }, 14);
  f.cyl("village-stone", 0.07, 0.1, 0.36, { at: [0, 1.6, 0] }, 8);
  f.sphere("village-stone", 0.11, { at: [0, 1.84, 0] }, 10);
  // Four threads of water fall from the lip of the bowl.
  for (let i = 0; i < 4; i++) {
    const angle = (i * PI) / 2 + PI / 4;
    f.cyl("village-water", 0.022, 0.034, 0.95, { at: [Math.sin(angle) * 0.6, 1.04, Math.cos(angle) * 0.6] }, 6, true);
  }
  // A bamboo ladle rests on the rim.
  f.cyl("planks", 0.014, 0.014, 0.6, { at: [0.62, 0.74, 0.74], rot: [0, 0.6, PI / 2] }, 6);
  f.cyl("planks", 0.06, 0.06, 0.09, { at: [0.36, 0.76, 0.9] }, 8);
  return f.build();
}

/** A stone well under its own small roof, with a bucket on the rope. */
function well() {
  const f = new Forge("village-well", 1.6);
  plinth(f);
  f.lathe("village-stone", [[0.78, 0], [0.8, 0.72], [0.7, 0.78], [0.56, 0.78], [0.56, 0.2]], { at: [0, 0.2, 0] }, 12);
  f.cyl("village-water", 0.56, 0.56, 0.02, { at: [0, 0.5, 0] }, 12);
  for (const side of [-1, 1]) f.box("village-cedar", [0.14, 2.3, 0.14], { at: [side * 0.86, 1.35, 0] }, 0.012);
  f.cyl("village-cedar", 0.06, 0.06, 1.9, { at: [0, 2.05, 0], rot: [0, 0, PI / 2] }, 8);
  f.cyl("burlap", 0.018, 0.018, 0.85, { at: [0.12, 1.62, 0] }, 5);
  f.cyl("planks", 0.15, 0.12, 0.26, { at: [0.12, 1.1, 0] }, 10);
  const ridge = gable(f, "village-thatch", 2.2, 0.55, 2.45, 0.6, 0.3, 0.12);
  f.box("village-cedar", [2.1, 0.08, 0.3], { at: [0, ridge - 0.02, 0] }, 0.01);
  return f.build();
}

/** The roofed notice board at the village gate. Its writing faces +Z and -Z. */
function notice() {
  const f = new Forge("village-notice");
  f.box("village-stone", [2.1, 0.5, 1.5], { at: [0, 0.25, 0] }, 0.04);
  f.box("village-stone", [1.8, 0.14, 1.2], { at: [0, 0.57, 0] }, 0.03);
  for (const side of [-1, 1]) {
    f.box("village-cedar", [0.17, 2.1, 0.17], { at: [side * 0.92, 1.55, 0] }, 0.015);
    picture(f, "village-writing", 1.66, 0.62, WRITING.notice, { at: [0, 1.62, side * 0.046], rot: [0, side < 0 ? PI : 0, 0] });
  }
  f.box("planks", [1.72, 0.7, 0.08], { at: [0, 1.62, 0] }, 0.01);
  f.box("village-cedar", [2.0, 0.1, 0.12], { at: [0, 2.03, 0] }, 0.01);
  f.box("village-cedar", [2.0, 0.1, 0.12], { at: [0, 1.2, 0] }, 0.01);
  gable(f, "village-roof", 2.5, 0.42, 2.6, 0.52, 0.3, 0.1);
  f.cyl("village-roof", 0.09, 0.09, 2.4, { at: [0, 2.6 + 0.42 * Math.tan(0.52) + 0.1, 0], rot: [0, 0, PI / 2] }, 8);
  return f.build();
}

/** A family grave: a stone pillar on its steps, with wooden prayer slats behind it. */
function grave() {
  const f = new Forge("village-grave", 1.4);
  plinth(f, 1.96, 0.18);
  f.box("village-stone", [1.1, 0.26, 1.0], { at: [0, 0.31, -0.1] }, 0.03);
  f.box("village-stone", [0.8, 0.24, 0.72], { at: [0, 0.56, -0.12] }, 0.03);
  f.box("village-stone", [0.46, 1.25, 0.44], { at: [0, 1.3, -0.14] }, 0.04);
  f.prism("village-stone", 0.02, 0.34, 0.14, 4, { at: [0, 1.99, -0.14], rot: [0, PI / 4, 0] });
  for (const [x, lean, h] of [[-0.42, 0.05, 2.0], [-0.27, -0.03, 2.25], [0.36, 0.04, 1.85]] as const)
    f.box("planks", [0.09, h, 0.02], { at: [x, 0.2 + h / 2, -0.66], rot: [0, 0, lean] }, 0);
  for (const side of [-1, 1]) {
    f.cyl("village-stone", 0.07, 0.06, 0.24, { at: [side * 0.38, 0.56, 0.32] }, 8);
    f.sphere("moss", 0.1, { at: [side * 0.38, 0.74, 0.32] }, 6);
  }
  f.box("village-stone", [0.3, 0.1, 0.2], { at: [0, 0.49, 0.36] }, 0.02);
  return f.build();
}

/** One tile of low dry-stone wall running along X: too low to hide behind, low enough to throw over. */
function lowWall() {
  const f = new Forge("village-low-wall", 1.8);
  f.box("village-stone", [TILE, 1.0, 1.7], { at: [0, 0.5, 0] }, 0);
  f.box("village-stone", [TILE, 0.14, 1.86], { at: [0, 1.07, 0] }, 0);
  for (const [x, z, r] of [[-0.7, 0.5, 0.22], [0.5, -0.4, 0.26], [0.9, 0.6, 0.15]] as const)
    f.sphere("moss", r, { at: [x, 1.14, z], scale: [1, 0.25, 1] }, 8);
  return f.build();
}

/** One tile of the boundary wall, running along X with the village on its +Z side. */
function wall() {
  const f = new Forge("village-wall", 1.8);
  // The face towards the village stands almost on the tile's edge, so nobody stops short of it.
  const z = 0.45;
  f.box("village-stone", [TILE, 0.9, 1.4], { at: [0, 0.45, z] }, 0);
  f.box("village-plaster", [TILE, 1.1, 1.1], { at: [0, 1.45, z] }, 0);
  f.box("village-cedar", [TILE, 0.12, 1.24], { at: [0, 2.03, z] }, 0);
  for (const side of [-1, 1])
    f.box("village-roof", [TILE, 0.1, 0.95], { at: [0, 2.3, z + side * 0.4], rot: [side * 0.5, 0, 0] }, 0);
  f.cyl("village-roof", 0.1, 0.1, TILE, { at: [0, 2.56, z], rot: [0, 0, PI / 2] }, 8);
  return f.build();
}

/** A square pier of the same wall: the corners, and what the closing zone raises. */
function block() {
  const f = new Forge("village-block", 1.8);
  f.box("village-stone", [2.34, 0.9, 2.34], { at: [0, 0.45, 0] }, 0);
  f.box("village-plaster", [2.1, 1.1, 2.1], { at: [0, 1.45, 0] }, 0);
  f.box("village-cedar", [2.24, 0.12, 2.24], { at: [0, 2.03, 0] }, 0);
  f.prism("village-roof", 0.12, 1.72, 0.52, 4, { at: [0, 2.35, 0], rot: [0, PI / 4, 0] });
  f.sphere("village-roof", 0.13, { at: [0, 2.66, 0] }, 8);
  return f.build();
}

/** A roofed gate in the boundary wall, shut. Runs along X with the village on its +Z side. */
function gate() {
  const f = new Forge("village-gate");
  const z = 0.45;
  for (const side of [-1, 1]) {
    f.box("village-stone", [0.5, 0.3, 1.2], { at: [side * 0.95, 0.15, z] }, 0.02);
    f.box("village-cedar", [0.3, 3.0, 0.3], { at: [side * 1.0, 1.5, z + 0.3] }, 0.02);
    f.box("village-cedar", [0.22, 2.6, 0.22], { at: [side * 1.0, 1.3, z - 0.4] }, 0.02);
    // Each leaf: boards, three battens and a row of iron studs.
    f.box("planks", [0.86, 2.5, 0.08], { at: [side * 0.43, 1.3, z + 0.3] }, 0.01);
    for (const y of [0.4, 1.3, 2.2]) {
      f.box("village-cedar", [0.84, 0.14, 0.04], { at: [side * 0.43, y, z + 0.36] }, 0.008);
      for (let i = 0; i < 4; i++) f.sphere("steel-dark", 0.03, { at: [side * (0.13 + i * 0.2), y, z + 0.385] }, 6);
    }
  }
  f.box("village-cedar", [TILE, 0.3, 0.34], { at: [0, 2.75, z + 0.3] }, 0.02);
  f.box("village-cedar", [TILE, 0.2, 0.24], { at: [0, 2.6, z - 0.4] }, 0.02);
  const ridge = gable(f, "village-roof", TILE + 0.5, 0.75, 3.0, 0.52, 0.35, 0.12);
  f.frame({ at: [0, 0, 0] }, () => f.cyl("village-roof", 0.12, 0.12, TILE + 0.4, { at: [0, ridge, 0], rot: [0, 0, PI / 2] }, 8));
  for (const side of [-1, 1]) paperLantern(f, [side * 0.72, 2.6, z + 0.52]);
  return f.build();
}

/** The trunk and limbs of a cherry tree in a ring of stones. The game adds the blossom. */
function cherry() {
  const f = new Forge("village-cherry", 1.2);
  f.prism("village-stone", 1.0, 1.06, 0.26, 8, { at: [0, 0.13, 0], rot: [0, PI / 8, 0] });
  f.cyl("ground", 0.86, 0.86, 0.04, { at: [0, 0.27, 0] }, 12);
  for (const [x, z, r] of [[0.5, 0.4, 0.2], [-0.55, 0.2, 0.16], [0.1, -0.6, 0.18]] as const)
    f.sphere("moss", r, { at: [x, 0.28, z], scale: [1, 0.35, 1] }, 8);
  f.cyl("sakura-bark", 0.2, 0.3, 1.1, { at: [0, 0.8, 0], rot: [0, 0, 0.06] }, 9);
  f.cyl("sakura-bark", 0.16, 0.2, 0.9, { at: [-0.07, 1.72, 0.04], rot: [0.1, 0, 0.08] }, 9);
  for (const [turn, lean, length] of [[0.3, 0.75, 1.5], [2.3, 0.85, 1.35], [4.3, 0.7, 1.45], [1.3, 0.3, 1.3]] as const)
    f.frame({ at: [-0.1, 2.05, 0.08], rot: [0, turn, 0] }, () => {
      f.cyl("sakura-bark", 0.06, 0.12, length, { at: [(Math.sin(lean) * length) / 2, (Math.cos(lean) * length) / 2, 0], rot: [0, 0, -lean] }, 7);
    });
  return f.build();
}

// Destructibles.

/** Three straw-wrapped sake barrels, the kind stacked in front of a shrine. */
function sakeBarrels() {
  const f = new Forge("sake-barrels", 1.4);
  const barrel = (x: number, y: number, z: number, turn: number) =>
    f.frame({ at: [x, y, z], rot: [0, turn, 0] }, () => {
      f.lathe("village-thatch", [[0, 0], [0.42, 0], [0.46, 0.36], [0.42, 0.72], [0, 0.72]], {}, 14);
      for (const band of [0.1, 0.36, 0.62]) f.torus("burlap", 0.455 - Math.abs(band - 0.36) * 0.1, 0.022, { at: [0, band, 0], rot: [PI / 2, 0, 0] }, 16);
      // The brewer's mark: a white face with a red sun.
      f.cyl("paint-ivory", 0.25, 0.25, 0.02, { at: [0, 0.36, 0.455], rot: [PI / 2, 0, 0] }, 14);
      f.cyl("village-vermilion", 0.13, 0.13, 0.025, { at: [0, 0.36, 0.458], rot: [PI / 2, 0, 0] }, 12);
    });
  barrel(-0.48, 0, 0.1, 0.2);
  barrel(0.48, 0, -0.05, -0.3);
  barrel(0.02, 0.72, 0.02, 0.05);
  return f.build();
}

/** Sheaves of rice straw: two bales lying down and a stook standing against them. */
function hayBales() {
  const f = new Forge("hay-bales", 1.2);
  const bale = (at: readonly [number, number, number], turn: number, length = 1.5) =>
    f.frame({ at, rot: [0, turn, 0] }, () => {
      f.cyl("village-thatch", 0.4, 0.4, length, { rot: [0, 0, PI / 2] }, 12);
      for (const band of [-0.4, 0.4]) f.torus("burlap", 0.405, 0.02, { at: [band * length * 0.8, 0, 0], rot: [0, PI / 2, 0] }, 14);
    });
  bale([0, 0.4, 0.42], 0.06);
  bale([0, 0.4, -0.42], -0.05);
  bale([0, 1.08, 0], 0.02, 1.3);
  f.cyl("village-thatch", 0.08, 0.34, 1.15, { at: [0.72, 0.58, 0.6], rot: [0.12, 0, -0.14] }, 9);
  f.torus("burlap", 0.17, 0.02, { at: [0.76, 0.75, 0.62], rot: [PI / 2, 0, 0] }, 10);
  return f.build();
}

/** One tile of plank fence, running along X. */
function woodFence() {
  const f = new Forge("wood-fence", 1.4);
  for (const x of [-1.08, 0, 1.08]) {
    f.box("planks-dark", [0.13, 1.32, 0.13], { at: [x, 0.66, 0] }, 0.015);
    f.prism("planks-dark", 0.01, 0.1, 0.09, 4, { at: [x, 1.36, 0], rot: [0, PI / 4, 0] });
  }
  for (const y of [0.38, 0.98]) f.box("planks-dark", [2.3, 0.1, 0.06], { at: [0, y, -0.06] }, 0.01);
  const random = seeded(88);
  for (let i = 0; i < 11; i++) {
    const h = 1.08 + random() * 0.12;
    f.box("planks", [0.15, h, 0.035], { at: [-1.0 + i * 0.2, h / 2 + 0.06, 0.03], rot: [0, 0, (random() - 0.5) * 0.04] }, 0.008);
  }
  return f.build();
}

/** A two-wheeled handcart loaded with sacks and a crate. Its shafts point along +Z. */
function handcart() {
  const f = new Forge("handcart", 1.4);
  f.box("planks", [1.2, 0.08, 1.7], { at: [0, 0.66, -0.1] }, 0.012);
  for (const side of [-1, 1]) {
    f.box("planks-dark", [0.06, 0.3, 1.7], { at: [side * 0.6, 0.83, -0.1] }, 0.01);
    f.box("planks-dark", [0.07, 0.07, 2.5], { at: [side * 0.52, 0.6, 0.3] }, 0.012);
    // A wheel: rim, hub and eight spokes.
    f.frame({ at: [side * 0.74, 0.56, -0.15], rot: [0, PI / 2, 0] }, () => {
      f.torus("planks-dark", 0.52, 0.045, {}, 18);
      f.cyl("planks-dark", 0.09, 0.09, 0.16, { rot: [PI / 2, 0, 0] }, 8);
      for (let i = 0; i < 4; i++) f.box("planks", [1.0, 0.05, 0.04], { rot: [0, 0, (i * PI) / 4] }, 0.008);
    });
  }
  f.cyl("steel-dark", 0.03, 0.03, 1.5, { at: [0, 0.56, -0.15], rot: [0, 0, PI / 2] }, 6);
  f.box("planks-dark", [1.1, 0.07, 0.07], { at: [0, 0.6, 1.5] }, 0.012);
  f.box("planks-dark", [0.07, 0.6, 0.07], { at: [0, 0.3, 1.1] }, 0.012);
  f.box("burlap", [0.56, 0.3, 0.78], { at: [-0.26, 0.86, -0.5], rot: [0, 0.2, 0] }, 0.12);
  f.box("burlap", [0.56, 0.3, 0.78], { at: [0.28, 0.86, -0.4], rot: [0, -0.15, 0] }, 0.12);
  f.box("burlap", [0.54, 0.28, 0.74], { at: [0.02, 1.13, -0.46], rot: [0, 1.3, 0] }, 0.12);
  f.box("planks", [0.56, 0.44, 0.56], { at: [0.05, 0.92, 0.4], rot: [0, 0.3, 0] }, 0.015);
  return f.build();
}

/** Big storage jars, one of them lidded, and a small one fallen over. */
function pottery() {
  const f = new Forge("pottery", 1.2);
  const jar = (at: readonly [number, number, number], scale: number, lid: boolean) =>
    f.frame({ at, scale }, () => {
      f.lathe("village-clay", [[0.2, 0], [0.42, 0.24], [0.5, 0.6], [0.4, 0.92], [0.26, 1.02], [0.3, 1.1]], {}, 14);
      if (lid) {
        f.cyl("planks", 0.33, 0.33, 0.05, { at: [0, 1.12, 0] }, 12);
        f.box("planks-dark", [0.3, 0.05, 0.07], { at: [0, 1.17, 0] }, 0.01);
      } else f.cyl("village-water", 0.27, 0.27, 0.01, { at: [0, 1.0, 0] }, 10);
    });
  jar([-0.45, 0, -0.3], 1.1, true);
  jar([0.5, 0, -0.1], 0.95, false);
  jar([-0.1, 0, 0.6], 0.75, true);
  f.frame({ at: [0.62, 0.2, 0.72], rot: [0, 0.6, PI / 2] }, () =>
    f.lathe("village-clay", [[0.1, 0], [0.2, 0.12], [0.22, 0.3], [0.14, 0.44], [0.16, 0.5]], {}, 10),
  );
  return f.build();
}

export const village: Record<string, () => THREE.Group> = {
  farmhouse,
  dojo,
  shop,
  cottage,
  shrine,
  torii,
  lantern,
  fountain,
  well,
  notice,
  grave,
  "low-wall": lowWall,
  wall,
  block,
  gate,
  cherry,
  "sake-barrels": sakeBarrels,
  "hay-bales": hayBales,
  "wood-fence": woodFence,
  handcart,
  pottery,
};
