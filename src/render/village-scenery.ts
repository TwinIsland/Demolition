import * as THREE from "three";
import { TILE_SIZE } from "../core/geometry";
import { groundAt, type MapDefinition } from "../core/pack-api";
import type { GameSnapshot } from "../core/types";
import type { SceneryId } from "./cover-models";
import { GROUND_LEVEL, groundGeometry, hash, tuftGeometry } from "./jungle-scenery";
import type { Models } from "./models";

/**
 * A village arena: its landmarks, which are the map's permanent walls, and everything besides
 * walls and obstacles: the lawn, the paved streets and plaza, and the countryside around the
 * boundary wall.
 *
 * The map names what stands on each wall cell (`featureAt`). A building covers several cells and
 * is drawn one cell at a time from a model that was exported cut along the grid, so the closing
 * zone can take cells away one by one.
 */

const QUARTER = Math.PI / 2;
/** Where each picture sits on the writing sheet: left, top, right, bottom as fractions. */
const NOTICE = [0, 0, 1, 0.375] as const;

/** The landmark on one permanent wall cell, standing on the cell's own origin. */
export function villageWall(models: Models, map: MapDefinition, size: number, x: number, z: number) {
  const feature = map.featureAt?.(x, z, size),
    seed = (Math.imul(x * 31 + z * 131, 40503) >>> 0) % 997,
    last = size - 1;
  if (!x || !z || x === last || z === last) {
    if ((!x || x === last) && (!z || z === last)) return models.scenery("village-block");
    const piece = models.scenery(feature === "gate" ? "village-gate" : "village-wall");
    // Authored along X with the village to its south; turn that side towards the middle.
    piece.rotation.y = !z ? 0 : z === last ? Math.PI : !x ? QUARTER : -QUARTER;
    return piece;
  }
  const [kind, footprint, cell] = (feature ?? "").split(":");
  switch (kind) {
    case "farmhouse":
    case "dojo":
    case "shop":
    case "cottage":
    case "shrine": {
      const [columns, rows] = footprint.split("x").map(Number),
        [column, row] = cell.split(",").map(Number);
      const piece = models.sceneryPart(`village-${kind}`, `cell-${column}-${row}`);
      // The model is centred on its footprint; this cell is one corner or edge of it.
      piece.children[0]?.position.set(
        ((columns - 1) / 2 - column) * TILE_SIZE,
        0,
        ((rows - 1) / 2 - row) * TILE_SIZE,
      );
      return piece;
    }
    case "torii": {
      // Two posts carry one gate over the cell between them; each cell draws its own half.
      const index = Number(cell),
        piece = models.sceneryPart("village-torii", `post-${index}`),
        reach = index ? -TILE_SIZE : TILE_SIZE;
      if (footprint === "z") {
        piece.rotation.y = -QUARTER;
        piece.position.z = reach;
      } else piece.position.x = reach;
      const holder = new THREE.Group();
      holder.add(piece);
      return holder;
    }
    case "low-wall": {
      const piece = models.scenery("village-low-wall");
      const along = (dx: number, dz: number) => map.featureAt?.(x + dx, z + dz, size) === "low-wall";
      if (!along(1, 0) && !along(-1, 0) && (along(0, 1) || along(0, -1))) piece.rotation.y = QUARTER;
      return piece;
    }
    case "cherry":
      return models.cherryTree(seed);
    case "rock":
      return models.wall("rainforest", "rock", seed);
    case "lantern":
    case "fountain":
    case "well":
    case "notice":
    case "grave": {
      const piece = models.scenery(`village-${kind}` as SceneryId);
      // Lanterns and wells look the same from every side; turning them hides the repetition.
      if (kind === "lantern" || kind === "well") piece.rotation.y = (seed % 4) * QUARTER;
      return piece;
    }
  }
  return models.scenery("village-block");
}

let unit: THREE.BufferGeometry | undefined;
/** A 1 x 1 slab, 6 cm thick, with its top on y = 0. Paving is laid in world space by its surface profile. */
function pavingStone() {
  if (!unit) {
    unit = new THREE.BoxGeometry(1, 0.06, 1);
    unit.translate(0, -0.03, 0);
  }
  return unit;
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

let hill: THREE.BufferGeometry | undefined;
let peak: THREE.BufferGeometry | undefined;
/** A far mountain with snow on its upper third, coloured per vertex. */
function peakGeometry() {
  if (peak) return peak;
  peak = new THREE.ConeGeometry(1, 1, 28, 6, true);
  peak.translate(0, 0.5, 0);
  const position = peak.attributes.position,
    colors = new Float32Array(position.count * 3),
    rock = new THREE.Color("#5c6f8a"),
    snow = new THREE.Color("#f4f7fb"),
    mixed = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i),
      // The snow line wanders around the cone.
      line = 0.62 + 0.06 * Math.sin(Math.atan2(position.getZ(i), position.getX(i)) * 5);
    mixed.copy(rock).lerp(snow, Math.min(1, Math.max(0, (y - line) / 0.1)));
    mixed.toArray(colors, i * 3);
    // Concave flanks: the cone narrows quickly, then runs out wide at the foot.
    const spread = 1 + (1 - y) ** 2 * 0.9;
    position.setX(i, position.getX(i) * spread);
    position.setZ(i, position.getZ(i) * spread);
  }
  peak.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  peak.computeVertexNormals();
  return peak;
}

let petal: THREE.BufferGeometry | undefined;
let petalFall: THREE.MeshStandardMaterial | undefined;
let petalClock: { value: number } | undefined;
/** Height a petal starts from, and so the length of its fall. */
const PETAL_DROP = 5.5;
/**
 * Cherry petals on the wind. Each is one small leaf-shaped card placed at the top of its fall;
 * the vertex shader lets it sink, drift and tumble, and starts it again when it lands. Every
 * petal takes its own timing from where it stands, so the arena's batching costs it nothing.
 */
function petalMaterial(time: { value: number }) {
  if (petalFall && petalClock === time) return petalFall;
  petalFall?.dispose();
  petalClock = time;
  petalFall = new THREE.MeshStandardMaterial({
    name: "village-petals",
    color: "#ffd3e2",
    roughness: 0.7,
    side: THREE.DoubleSide,
  });
  petalFall.onBeforeCompile = (shader) => {
    shader.uniforms.vpTime = time;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float vpTime;")
      .replace(
        "#include <begin_vertex>",
        /* glsl */ `#include <begin_vertex>
        #ifdef USE_INSTANCING
        {
          vec4 vpOrigin = modelMatrix * (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0));
          float vpSeed = fract(sin(dot(vpOrigin.xz, vec2(12.9898, 78.233))) * 43758.5453);
          float vpClock = vpTime * (0.55 + vpSeed * 0.5) + vpSeed * ${PETAL_DROP.toFixed(1)};
          float vpFall = mod(vpClock, ${PETAL_DROP.toFixed(1)});
          // Tumble about the petal's own long axis, then sink and drift with the breeze.
          float vpTurn = vpClock * (2.0 + vpSeed * 3.0);
          transformed.yz = mat2(cos(vpTurn), -sin(vpTurn), sin(vpTurn), cos(vpTurn)) * transformed.yz;
          transformed.y -= vpFall;
          transformed.x += sin(vpClock * 1.3 + vpSeed * 40.0) * 0.5 + vpFall * 0.35;
          transformed.z += cos(vpClock * 0.9 + vpSeed * 17.0) * 0.4;
        }
        #endif`,
      );
  };
  return petalFall;
}
function petalGeometry() {
  if (petal) return petal;
  petal = new THREE.BufferGeometry();
  // A kite 9 cm long, lying flat.
  petal.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([-0.045, 0, 0, 0, 0, 0.028, 0.045, 0, 0, 0, 0, -0.028], 3),
  );
  petal.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  petal.setIndex([0, 1, 2, 0, 2, 3]);
  return petal;
}

/** Whole buildings standing outside the wall: cell offset from the grid's corner, model and turn. */
const NEIGHBOURS: readonly (readonly [number, number, SceneryId, number])[] = [
  [-5, 3, "village-farmhouse", QUARTER],
  [-4, 14, "village-cottage", Math.PI],
  [-7, 9, "village-shop", QUARTER],
  [25, 4, "village-cottage", 0],
  [26, 12, "village-farmhouse", -QUARTER],
  [24, 18, "village-cottage", QUARTER],
  [4, -5, "village-cottage", -QUARTER],
  [16, -6, "village-farmhouse", 0],
  [5, 25, "village-farmhouse", Math.PI],
  [15, 24, "village-shop", 0],
  [-9, -6, "village-shrine", 0],
  [29, 27, "village-dojo", Math.PI],
];

export function buildVillage(
  root: THREE.Group,
  models: Models,
  map: MapDefinition,
  state: Readonly<GameSnapshot>,
) {
  const size = state.size,
    half = (size * TILE_SIZE) / 2,
    middle = (size - 1) / 2,
    at = (cell: number) => (cell - middle) * TILE_SIZE,
    m = models.materials;
  const add = (mesh: THREE.Mesh, shadows: boolean) => {
    mesh.castShadow = shadows;
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  };

  // One lawn under everything; tilled earth shows through where the map says mud.
  const data = new Uint8Array(size * size * 4);
  for (let z = 0; z < size; z++)
    for (let x = 0; x < size; x++) data[(z * size + x) * 4] = groundAt(map, x, z) === "mud" ? 255 : 0;
  const mask = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  mask.magFilter = mask.minFilter = THREE.LinearFilter;
  mask.needsUpdate = true;
  const ground = new THREE.Mesh(
    groundGeometry(),
    m.soil(mask, [-half, -half, size * TILE_SIZE, size * TILE_SIZE], { litter: 0, gain: 1.25 }),
  );
  ground.position.y = GROUND_LEVEL;
  ground.receiveShadow = true;
  root.add(ground);

  // Streets and the plaza. A paved cell outside the grid continues a street past its gate.
  const flagstone = m.palette("df:village-path")!,
    cobble = m.palette("df:village-cobble")!,
    reach = 16;
  const pave = (x: number, z: number, material: THREE.Material) => {
    const slab = add(new THREE.Mesh(pavingStone(), material), false);
    slab.position.set(at(x), 0.012, at(z));
    slab.scale.set(TILE_SIZE, 1, TILE_SIZE);
  };
  for (let z = 0; z < size; z++)
    for (let x = 0; x < size; x++)
      if (groundAt(map, x, z) === "stone")
        pave(x, z, Math.max(Math.abs(x - middle), Math.abs(z - middle)) <= 2 ? cobble : flagstone);
  for (let step = 1; step <= reach; step++)
    for (const [x, z] of [
      [middle, -step],
      [middle, size - 1 + step],
      [-step, middle],
      [size - 1 + step, middle],
    ])
      pave(x, z, flagstone);

  // The welcome, flat on the lawn beside the arrival point: readable from straight above.
  const welcome = new THREE.Mesh(inscriptionGeometry(), m.palette("df:village-writing")!);
  welcome.position.set(at(2.5), 0.006, at(1));
  welcome.receiveShadow = true;
  root.add(welcome);

  // Grass tufts wherever the lawn is open. Thinner than a jungle floor: this one is kept.
  const blades = m.grass(),
    tuft = tuftGeometry();
  for (let z = -3; z < size + 3; z++)
    for (let x = -3; x < size + 3; x++) {
      const inside = x > 0 && z > 0 && x < size - 1 && z < size - 1;
      if (inside && (groundAt(map, x, z) !== "grass" || state.tiles[z][x] === 1)) continue;
      if (!inside && x >= 0 && z >= 0 && x < size && z < size) continue;
      if (z === 1 && (x === 2 || x === 3)) continue;
      for (let i = 0; i < 7; i++) {
        const mesh = new THREE.Mesh(tuft, blades);
        mesh.position.set(
          at(x) + (hash(x, z, 10 + i) - 0.5) * TILE_SIZE,
          GROUND_LEVEL,
          at(z) + (hash(x, z, 30 + i) - 0.5) * TILE_SIZE,
        );
        mesh.rotation.y = hash(x, z, 70 + i) * 6.28;
        const scale = 0.55 + hash(x, z, 50 + i) * 0.6;
        mesh.scale.set(scale, scale * 0.8, scale);
        mesh.receiveShadow = true;
        root.add(mesh);
      }
    }

  const stand = (
    model: THREE.Object3D,
    x: number,
    z: number,
    scale: number,
    turn: number,
    shadows: boolean,
  ) => {
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

  // The rest of the village: houses beyond the wall, each on its own patch of ground.
  for (const [x, z, id, turn] of NEIGHBOURS) stand(models.scenery(id), at(x), at(z), 1, turn, true);

  // A procession of gates leads away from the north gate, and lanterns line the other roads.
  for (let step = 3; step <= 15; step += 3) {
    stand(models.scenery("village-torii"), at(middle), at(-step), 1, 0, step < 8);
    for (const side of [-1, 1]) {
      stand(models.scenery("village-lantern"), at(middle + side), at(size - 1 + step), 0.9, 0, false);
      stand(models.scenery("village-lantern"), at(-step), at(middle + side), 0.9, 0, false);
      stand(models.scenery("village-lantern"), at(size - 1 + step), at(middle + side), 0.9, 0, false);
    }
  }

  // Cherry trees, bushes and rocks in rings of cells around the wall. Trees grow with distance.
  const taken = new Set(NEIGHBOURS.map(([x, z]) => `${Math.round(x / 3)},${Math.round(z / 3)}`));
  for (let z = -reach; z < size + reach; z++)
    for (let x = -reach; x < size + reach; x++) {
      const ring = Math.max(-x, -z, x - (size - 1), z - (size - 1));
      if (ring < 1 || Math.abs(x - middle) <= 1 || Math.abs(z - middle) <= 1) continue;
      if (taken.has(`${Math.round(x / 3)},${Math.round(z / 3)}`)) continue;
      const px = at(x) + (hash(x, z, 1) - 0.5) * TILE_SIZE * 0.8,
        pz = at(z) + (hash(x, z, 2) - 0.5) * TILE_SIZE * 0.8,
        roll = hash(x, z, 3),
        turn = hash(x, z, 4) * 6.28,
        vary = hash(x, z, 5);
      if (roll < (ring <= 3 ? 0.07 : 0.15) && ring >= 2)
        stand(
          models.cherryTree(Math.floor(vary * 3)),
          px,
          pz,
          1.3 + vary * 0.7 + ring * 0.07,
          turn,
          ring <= 5,
        );
      else if (roll < 0.3 && ring <= 6)
        stand(models.scenery(vary < 0.5 ? "shrub-a" : "shrub-b"), px, pz, 2.2 + vary * 2.4, turn, false);
      else if (roll < 0.34)
        stand(
          models.scenery((["rock-a", "rock-b", "rock-c", "rock-d"] as const)[Math.floor(vary * 4)]),
          px,
          pz,
          0.5 + vary * 0.8,
          turn,
          false,
        );
    }

  // Petals drift down over the whole village.
  const falling = petalMaterial(m.grassTime),
    leaf = petalGeometry();
  for (let i = 0; i < 420; i++) {
    const mesh = new THREE.Mesh(leaf, falling);
    mesh.position.set(
      (hash(i, 1, 41) - 0.5) * (size + 8) * TILE_SIZE,
      PETAL_DROP,
      (hash(i, 2, 42) - 0.5) * (size + 8) * TILE_SIZE,
    );
    mesh.rotation.y = hash(i, 3, 43) * 6.28;
    root.add(mesh);
  }

  // Green hills close the horizon, and one white mountain stands behind them to the north.
  hill ??= new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  const slopes = m.standard("village-hill", "#6f9450");
  for (let i = 0; i < 14; i++) {
    const angle = (i / 14) * Math.PI * 2 + hash(i, 0, 21) * 0.3,
      distance = 105 + hash(i, 0, 22) * 45,
      width = 34 + hash(i, 0, 23) * 30;
    const mound = new THREE.Mesh(hill, slopes);
    mound.position.set(Math.sin(angle) * distance, -1, Math.cos(angle) * distance);
    mound.scale.set(width, 9 + hash(i, 0, 24) * 13, width * (0.7 + hash(i, 0, 25) * 0.5));
    root.add(mound);
  }
  const summit = new THREE.Mesh(
    peakGeometry(),
    new THREE.MeshStandardMaterial({ name: "village-peak", vertexColors: true, roughness: 1 }),
  );
  summit.position.set(-38, -2, -172);
  summit.scale.set(52, 74, 52);
  root.add(summit);
}
