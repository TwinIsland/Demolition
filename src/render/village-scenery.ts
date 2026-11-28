import * as THREE from "three";
import { TILE_SIZE } from "../core/geometry";
import { groundAt, type MapDefinition } from "../core/pack-api";
import type { GameSnapshot } from "../core/types";
import type { SceneryId } from "./cover-models";
import { hash } from "./jungle-scenery";
import type { Models } from "./models";

/**
 * A village arena: its landmarks, which are the map's permanent walls, and everything besides
 * walls and obstacles: the painted ground with its roads and plaza, and the countryside around
 * the boundary wall.
 *
 * Every model is one of the KayKit packs (see tools/model-import/kaykit.mjs), at the size it
 * stands in the game. The map names what stands on each wall cell (`featureAt`). A building
 * covers several cells and is drawn whole from its north-west cell.
 */

const QUARTER = Math.PI / 2;
/** Where each picture sits on the writing sheet: left, top, right, bottom as fractions. */
const NOTICE = [0, 0, 1, 0.375] as const;
/** Turn that brings a model's entrance, authored towards +Z (south), to each side. */
const FACING: Record<string, number> = { s: 0, n: Math.PI, e: QUARTER, w: -QUARTER };

/** One model of a building: its id, and where it stands in cells from the middle, entrance to +Z. */
type Wing = readonly [id: SceneryId, x: number, z: number, turn?: number];
/** What each kind of building is made of, by how many cells wide its front is. */
const BUILDINGS: Record<string, (width: number, seed: number) => readonly Wing[]> = {
  // The training ground: the archery range, and the barracks beside it where there is room.
  dojo: (width) =>
    width >= 4
      ? [
          ["village-archery", -1, 0],
          ["village-barracks", 1, 0],
        ]
      : [["village-archery", 0, 0]],
  shop: () => [["village-market", 0, 0]],
  shrine: () => [["village-church", 0, 0]],
  tavern: () => [["village-tavern", 0, 0]],
  house: (_, seed) => [[seed % 2 ? "village-house-a" : "village-house-c", 0, 0]],
  cottage: () => [["village-house-b", 0, 0]],
  smithy: () => [["village-blacksmith", 0, 0]],
  windmill: () => [["village-windmill", 0, 0]],
};

/** The landmark on one permanent wall cell, standing on the cell's own origin. */
export function villageWall(models: Models, map: MapDefinition, size: number, x: number, z: number) {
  const feature = map.featureAt?.(x, z, size),
    seed = (Math.imul(x * 31 + z * 131, 40503) >>> 0) % 997,
    last = size - 1;
  if (!x || !z || x === last || z === last) {
    // A tower closes each corner, and the wall runs between them.
    if ((!x || x === last) && (!z || z === last)) return models.scenery("village-tower");
    const piece = models.scenery(feature === "gate" ? "village-gate" : "village-wall");
    // Authored along X; turn its length along the side it stands on.
    piece.rotation.y = !z ? 0 : z === last ? Math.PI : !x ? QUARTER : -QUARTER;
    return piece;
  }
  const [kind, footprint, cell, front] = (feature ?? "").split(":");
  const build = BUILDINGS[kind];
  if (build) {
    const holder = new THREE.Group();
    // The whole building is drawn from its first cell; the others only keep people out.
    if (cell !== "0,0") return holder;
    const [columns, rows] = footprint.split("x").map(Number),
      sideways = front === "e" || front === "w";
    const inner = new THREE.Group();
    inner.position.set(((columns - 1) / 2) * TILE_SIZE, 0, ((rows - 1) / 2) * TILE_SIZE);
    inner.rotation.y = FACING[front] ?? 0;
    for (const [id, dx, dz, turn = 0] of build(sideways ? rows : columns, seed)) {
      const wing = models.scenery(id);
      wing.position.set(dx * TILE_SIZE, 0, dz * TILE_SIZE);
      wing.rotation.y = turn;
      inner.add(wing);
    }
    holder.add(inner);
    return holder;
  }
  switch (kind) {
    case "arch": {
      // Two piers carry one arch over the cell between them; the first cell draws all of it.
      const holder = new THREE.Group();
      if (cell !== "0") return holder;
      const piece = models.scenery("village-arch");
      if (footprint === "z") {
        piece.rotation.y = QUARTER;
        piece.position.z = TILE_SIZE;
      } else piece.position.x = TILE_SIZE;
      holder.add(piece);
      return holder;
    }
    case "low-wall": {
      const piece = models.scenery("village-low-wall");
      const along = (dx: number, dz: number) => map.featureAt?.(x + dx, z + dz, size) === "low-wall";
      if (!along(1, 0) && !along(-1, 0) && (along(0, 1) || along(0, -1))) piece.rotation.y = QUARTER;
      return piece;
    }
    case "tree": {
      const piece = models.scenery(seed % 3 ? "village-tree-a" : "village-tree-b");
      piece.rotation.y = (seed % 16) * 0.39;
      piece.scale.setScalar(0.9 + (seed % 5) * 0.06);
      return piece;
    }
    case "rock": {
      const piece = models.scenery(seed % 2 ? "village-rock-a" : "village-rock-b");
      piece.rotation.y = (seed % 16) * 0.39;
      return piece;
    }
    case "grave": {
      const piece = models.scenery(
        (["village-grave-a", "village-grave-b", "village-grave-c"] as const)[seed % 3],
      );
      // Headstones face the street, a little out of true.
      piece.rotation.y = -QUARTER + ((seed % 7) - 3) * 0.06;
      return piece;
    }
    case "lantern":
      return models.scenery("village-lantern");
    case "fountain":
      return models.scenery("village-well");
    case "notice":
      return models.scenery("village-notice");
  }
  return models.scenery("village-block");
}

let inscription: THREE.BufferGeometry | undefined;
/** The village's welcome, laid flat on the ground so that even the overhead view can read it. */
function inscriptionGeometry() {
  if (inscription) return inscription;
  inscription = new THREE.PlaneGeometry(4.4, 1.65);
  inscription.rotateX(-Math.PI / 2);
  const uv = inscription.attributes.uv;
  // Palette textures follow the glTF convention: v runs down the image.
  for (let i = 0; i < uv.count; i++)
    uv.setXY(
      i,
      NOTICE[0] + uv.getX(i) * (NOTICE[2] - NOTICE[0]),
      NOTICE[1] + (1 - uv.getY(i)) * (NOTICE[3] - NOTICE[1]),
    );
  return inscription;
}

/** Cells of countryside painted around the grid, and pixels to a cell. */
const MARGIN = 7;
const CELL = 40;
/** The colours of the ground, picked to sit beside the packs' own greens and browns. */
const GRASS = "#84b455";
const ROAD = "#d2b078";
const ROAD_EDGE = "#b08e58";
const COBBLE = ["#b9b6ab", "#c7c4b8", "#a9a69c", "#bfbbaf"];
const EARTH = "#8a6240";

/**
 * The village's ground as one painting: mottled lawn, dirt roads with rounded bends that run on
 * through the gates, the cobbled plaza and the tilled fields. Painted once per arena.
 */
function paintGround(map: MapDefinition, size: number) {
  const span = size + MARGIN * 2,
    canvas = document.createElement("canvas");
  canvas.width = canvas.height = span * CELL;
  const g = canvas.getContext("2d")!;
  const middle = (size - 1) / 2,
    inside = (x: number, z: number) => x >= 0 && z >= 0 && x < size && z < size;
  const stone = (x: number, z: number) => {
    if (inside(x, z)) return groundAt(map, x, z) === "stone";
    // The four main streets run on past their gates.
    return (x === middle && (z < 0 || z >= size)) || (z === middle && (x < 0 || x >= size));
  };
  // The plan names its plaza; a stone cell beside it that is no road (the well, a lantern) is plaza too.
  const named = (x: number, z: number) => inside(x, z) && map.featureAt?.(x, z, size) === "plaza";
  const paved = (x: number, z: number) =>
    named(x, z) ||
    (inside(x, z) &&
      stone(x, z) &&
      !!map.featureAt?.(x, z, size) &&
      (named(x - 1, z) || named(x + 1, z) || named(x, z - 1) || named(x, z + 1)));
  // A stretch of road shut in between two paved cells is paved over as well.
  const plaza = (x: number, z: number) =>
    paved(x, z) ||
    (inside(x, z) &&
      stone(x, z) &&
      ((paved(x - 1, z) && paved(x + 1, z)) || (paved(x, z - 1) && paved(x, z + 1))));
  /** Canvas position of a cell's middle. */
  const at = (cell: number) => (cell + MARGIN + 0.5) * CELL;

  g.fillStyle = GRASS;
  g.fillRect(0, 0, canvas.width, canvas.height);
  // Lighter and darker patches, then short strokes of grass.
  for (let i = 0; i < span * span * 0.6; i++) {
    const x = hash(i, 1, 201) * canvas.width,
      y = hash(i, 2, 202) * canvas.height,
      r = (0.5 + hash(i, 3, 203) * 1.4) * CELL;
    const patch = g.createRadialGradient(x, y, 0, x, y, r);
    patch.addColorStop(0, hash(i, 4, 204) < 0.5 ? "rgba(160,205,105,0.22)" : "rgba(88,140,62,0.2)");
    patch.addColorStop(1, "rgba(120,170,80,0)");
    g.fillStyle = patch;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.lineCap = "round";
  for (let i = 0; i < span * span * 5; i++) {
    const x = hash(i, 5, 205) * canvas.width,
      y = hash(i, 6, 206) * canvas.height;
    g.strokeStyle = hash(i, 7, 207) < 0.5 ? "rgba(168,210,112,0.5)" : "rgba(92,146,66,0.45)";
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (hash(i, 8, 208) - 0.5) * 5, y - 3 - hash(i, 9, 209) * 4);
    g.stroke();
  }

  // Tilled fields: rounded beds of earth with furrows.
  for (let z = 0; z < size; z++)
    for (let x = 0; x < size; x++) {
      if (groundAt(map, x, z) !== "mud") continue;
      const mud = (dx: number, dz: number) =>
        inside(x + dx, z + dz) && groundAt(map, x + dx, z + dz) === "mud";
      const inset = 0.1 * CELL,
        left = at(x) - CELL / 2 + (mud(-1, 0) ? 0 : inset),
        right = at(x) + CELL / 2 - (mud(1, 0) ? 0 : inset),
        top = at(z) - CELL / 2 + (mud(0, -1) ? 0 : inset),
        bottom = at(z) + CELL / 2 - (mud(0, 1) ? 0 : inset);
      g.fillStyle = EARTH;
      g.fillRect(left, top, right - left, bottom - top);
      g.strokeStyle = "rgba(60,38,22,0.55)";
      g.lineWidth = 2.5;
      for (let row = 0; row < 4; row++) {
        const y = at(z) - CELL / 2 + (row + 0.5) * (CELL / 4);
        if (y < top || y > bottom) continue;
        g.beginPath();
        g.moveTo(left + 2, y);
        g.lineTo(right - 2, y);
        g.stroke();
      }
    }

  // Roads: one stroke from each road cell to its road neighbours, edge first and bed over it.
  const reach = MARGIN;
  const stroke = (width: number, color: string) => {
    g.strokeStyle = g.fillStyle = color;
    g.lineWidth = width * CELL;
    g.lineJoin = "round";
    for (let z = -reach; z < size + reach; z++)
      for (let x = -reach; x < size + reach; x++) {
        if (!stone(x, z) || plaza(x, z)) continue;
        let joined = false;
        for (const [dx, dz] of [
          [1, 0],
          [0, 1],
        ]) {
          if (!stone(x + dx, z + dz)) continue;
          joined = true;
          g.beginPath();
          g.moveTo(at(x), at(z));
          g.lineTo(at(x + dx), at(z + dz));
          g.stroke();
        }
        if (!joined && !stone(x - 1, z) && !stone(x, z - 1)) {
          g.beginPath();
          g.arc(at(x), at(z), (width * CELL) / 2, 0, Math.PI * 2);
          g.fill();
        }
      }
  };
  stroke(0.84, ROAD_EDGE);
  stroke(0.7, ROAD);
  // Pebbles and wheel marks on the road bed.
  for (let z = -reach; z < size + reach; z++)
    for (let x = -reach; x < size + reach; x++) {
      if (!stone(x, z) || plaza(x, z)) continue;
      for (let i = 0; i < 5; i++) {
        g.fillStyle = hash(x, z, 220 + i) < 0.5 ? "rgba(150,118,70,0.55)" : "rgba(236,214,160,0.6)";
        g.beginPath();
        g.arc(
          at(x) + (hash(x, z, 230 + i) - 0.5) * CELL * 0.5,
          at(z) + (hash(x, z, 240 + i) - 0.5) * CELL * 0.5,
          1.2 + hash(x, z, 250 + i) * 1.8,
          0,
          Math.PI * 2,
        );
        g.fill();
      }
    }

  // The plaza: a bed of mortar under four rows of cobbles to a cell, every other row shifted.
  g.fillStyle = "#8f8c82";
  for (let z = 0; z < size; z++)
    for (let x = 0; x < size; x++)
      if (plaza(x, z)) {
        g.beginPath();
        g.roundRect(at(x) - CELL * 0.56, at(z) - CELL * 0.56, CELL * 1.12, CELL * 1.12, CELL * 0.16);
        g.fill();
      }
  const stoneSize = CELL / 4;
  for (let z = 0; z < size; z++)
    for (let x = 0; x < size; x++) {
      if (!plaza(x, z)) continue;
      for (let row = 0; row < 4; row++)
        for (let column = 0; column < 4; column++) {
          const gx = x * 4 + column,
            gz = z * 4 + row,
            shift = gz % 2 ? stoneSize / 2 : 0;
          g.fillStyle = COBBLE[Math.floor(hash(gx, gz, 260) * COBBLE.length)];
          g.beginPath();
          g.roundRect(
            at(x) - CELL / 2 + column * stoneSize + shift + 1,
            at(z) - CELL / 2 + row * stoneSize + 1,
            stoneSize - 2,
            stoneSize - 2,
            2.5,
          );
          g.fill();
        }
    }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Whole buildings outside the wall: the side they stand on, how far along it (0..1), cells out, model. */
const NEIGHBOURS: readonly (readonly ["n" | "s" | "e" | "w", number, number, SceneryId])[] = [
  ["w", 0.2, 4, "village-house-a"],
  ["w", 0.72, 5, "village-windmill"],
  ["w", 0.86, 3.5, "village-house-b"],
  ["e", 0.28, 4, "village-house-c"],
  ["e", 0.78, 4.5, "village-house-a"],
  ["n", 0.22, 4, "village-house-b"],
  ["n", 0.76, 5, "village-blacksmith"],
  ["s", 0.25, 4, "village-house-c"],
  ["s", 0.75, 5, "village-tavern"],
];

export function buildVillage(
  root: THREE.Group,
  models: Models,
  map: MapDefinition,
  state: Readonly<GameSnapshot>,
) {
  const size = state.size,
    width = size * TILE_SIZE,
    middle = (size - 1) / 2,
    at = (cell: number) => (cell - middle) * TILE_SIZE,
    m = models.materials;

  // The painted ground, and plain lawn running out to the hills beyond it.
  const painted = new THREE.Mesh(
    new THREE.PlaneGeometry((size + MARGIN * 2) * TILE_SIZE, (size + MARGIN * 2) * TILE_SIZE),
    new THREE.MeshStandardMaterial({ name: "village-ground", map: paintGround(map, size), roughness: 1 }),
  );
  painted.rotation.x = -Math.PI / 2;
  painted.receiveShadow = true;
  root.add(painted);
  const lawn = new THREE.Mesh(
    new THREE.CircleGeometry(420, 48),
    new THREE.MeshStandardMaterial({ name: "village-lawn", color: GRASS, roughness: 1 }),
  );
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.y = -0.04;
  lawn.receiveShadow = true;
  root.add(lawn);

  // The welcome, flat on the lawn beside the arrival point: readable from straight above.
  if (map.featureAt?.(3, 2, size) === "notice") {
    const welcome = new THREE.Mesh(inscriptionGeometry(), m.palette("df:village-writing")!);
    welcome.position.set(at(2.5), 0.012, at(1));
    welcome.receiveShadow = true;
    root.add(welcome);
  }

  const stand = (id: SceneryId, x: number, z: number, scale: number, turn: number, shadows: boolean) => {
    const model = models.scenery(id);
    model.position.set(x, 0, z);
    model.rotation.y = turn;
    model.scale.multiplyScalar(scale);
    model.traverse((part) => {
      if (!(part instanceof THREE.Mesh)) return;
      part.castShadow = shadows;
      part.receiveShadow = part.receiveShadow && shadows;
    });
    root.add(model);
  };

  // The rest of the village: a few houses beyond the wall, each looking back at it.
  const houses = NEIGHBOURS.map(([side, along, out, id]) => {
    const run = at(along * (size - 1)),
      off = side === "n" || side === "w" ? at(-out) : at(size - 1 + out),
      upright = side === "n" || side === "s";
    return {
      id,
      x: upright ? run : off,
      z: upright ? off : run,
      turn: FACING[{ n: "s", s: "n", e: "w", w: "e" }[side]],
    };
  });
  for (const house of houses) stand(house.id, house.x, house.z, 1, house.turn, true);

  // Lanterns line the four roads that leave through the gates.
  for (let step = 2; step <= MARGIN; step += 2)
    for (const side of [-1, 1]) {
      stand("village-lantern", at(middle + side * 0.8), at(-step), 1, 0, false);
      stand("village-lantern", at(middle + side * 0.8), at(size - 1 + step), 1, 0, false);
      stand("village-lantern", at(-step), at(middle + side * 0.8), 1, 0, false);
      stand("village-lantern", at(size - 1 + step), at(middle + side * 0.8), 1, 0, false);
    }

  // Trees, rocks and the odd field in the cells around the wall; the roads stay clear.
  const reach = 14;
  for (let z = -reach; z < size + reach; z++)
    for (let x = -reach; x < size + reach; x++) {
      const ring = Math.max(-x, -z, x - (size - 1), z - (size - 1));
      if (ring < 2 || Math.abs(x - middle) <= 1 || Math.abs(z - middle) <= 1) continue;
      const px = at(x) + (hash(x, z, 1) - 0.5) * TILE_SIZE * 0.8,
        pz = at(z) + (hash(x, z, 2) - 0.5) * TILE_SIZE * 0.8;
      if (houses.some((house) => Math.hypot(px - house.x, pz - house.z) < 6)) continue;
      const roll = hash(x, z, 3),
        turn = hash(x, z, 4) * 6.28,
        vary = hash(x, z, 5);
      if (roll < 0.1 + ring * 0.012)
        stand(
          vary < 0.6 ? "village-tree-a" : "village-tree-b",
          px,
          pz,
          1 + vary * 0.7 + ring * 0.05,
          turn,
          ring <= 6,
        );
      else if (roll < 0.14 + ring * 0.012 && ring >= 4)
        stand(vary < 0.5 ? "village-forest" : "village-forest-b", px, pz, 4.2 + vary * 1.6, turn, ring <= 6);
      else if (roll > 0.975)
        stand(vary < 0.5 ? "village-rock-a" : "village-rock-b", px, pz, 0.6 + vary, turn, false);
    }

  // Wooded hills close the horizon, mountains stand behind them, and a castle watches from the north.
  const edge = width / 2;
  for (let i = 0; i < 22; i++) {
    const angle = (i / 22) * Math.PI * 2 + hash(i, 0, 21) * 0.2,
      distance = edge + 62 + hash(i, 0, 22) * 30,
      scale = 9 + hash(i, 0, 23) * 5;
    stand(
      hash(i, 0, 24) < 0.5 ? "village-hills" : "village-hills-b",
      Math.sin(angle) * distance,
      Math.cos(angle) * distance,
      scale,
      hash(i, 0, 25) * 6.28,
      false,
    );
  }
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2 + hash(i, 0, 31) * 0.3,
      distance = edge + 135 + hash(i, 0, 32) * 60,
      scale = 26 + hash(i, 0, 33) * 18;
    stand(
      hash(i, 0, 34) < 0.6 ? "village-mountain" : "village-mountain-b",
      Math.sin(angle) * distance,
      Math.cos(angle) * distance,
      scale,
      hash(i, 0, 35) * 6.28,
      false,
    );
  }
  stand("village-castle", -22, -(edge + 96), 8, 0, false);
}
