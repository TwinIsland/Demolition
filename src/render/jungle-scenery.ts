import * as THREE from "three";
import { TILE_SIZE } from "../core/geometry";
import { groundAt, type MapDefinition } from "../core/pack-api";
import type { GameSnapshot } from "../core/types";
import type { Models } from "./models";

/**
 * Everything a rainforest arena has besides walls and obstacles: one continuous ground of grass
 * and mud, tufts of grass, and the forest that stands around the grid.
 *
 * All of it is added as plain meshes, so the arena's static batches turn it into a few instanced
 * draws per chunk. Level of detail is by distance from the grid: undergrowth and palms at the
 * edge, full trees behind them and low-polygon trees further out, where fog hides the difference.
 * Grass blades flatten themselves in the vertex shader beyond 34 metres.
 */

/** Stable 0..1 hash of a cell and a salt, so scenery never changes between rebuilds of a map. */
const hash = (x: number, z: number, salt: number) => {
  let n = Math.imul(x * 374761393 + z * 668265263 + salt * 2147483647, 1274126177);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};

let tuft: THREE.BufferGeometry | undefined;
/** A patch of short tapered blades. Normals point up so tufts shade like the lawn. */
function tuftGeometry() {
  if (tuft) return tuft;
  const positions: number[] = [],
    normals: number[] = [],
    colors: number[] = [];
  const root = new THREE.Color("#62803a"),
    tip = new THREE.Color("#b4cf74");
  const blades = 11;
  for (let i = 0; i < blades; i++) {
    const turn = (i / blades) * Math.PI * 2 + hash(i, 3, 1) * 0.8,
      reach = 0.03 + hash(i, 5, 2) * 0.22,
      height = 0.07 + hash(i, 7, 3) * 0.11,
      width = 0.007 + hash(i, 9, 4) * 0.006,
      lean = 0.01 + hash(i, 11, 5) * 0.05;
    const cx = Math.cos(turn),
      cz = Math.sin(turn);
    // Root corners sit across the blade's direction; the tip leans outward.
    const ax = cx * reach - cz * width,
      az = cz * reach + cx * width,
      bx = cx * reach + cz * width,
      bz = cz * reach - cx * width,
      tx = cx * (reach + lean),
      tz = cz * (reach + lean);
    // Both windings, so a blade is lit the same from either side without a double-sided material.
    positions.push(ax, 0, az, bx, 0, bz, tx, height, tz, bx, 0, bz, ax, 0, az, tx, height, tz);
    for (let side = 0; side < 2; side++) {
      normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
      colors.push(root.r, root.g, root.b, root.r, root.g, root.b, tip.r, tip.g, tip.b);
    }
  }
  tuft = new THREE.BufferGeometry();
  tuft.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  tuft.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  tuft.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return tuft;
}

let lawn: THREE.BufferGeometry | undefined;
const GROUND_EXTENT = 300;
/** Metres of ground covered by one repeat of the grass texture. */
const GROUND_TEXEL = 3.2;
function groundGeometry() {
  if (lawn) return lawn;
  lawn = new THREE.PlaneGeometry(GROUND_EXTENT, GROUND_EXTENT);
  lawn.rotateX(-Math.PI / 2);
  const uv = lawn.attributes.uv;
  for (let i = 0; i < uv.count; i++)
    uv.setXY(i, (uv.getX(i) * GROUND_EXTENT) / GROUND_TEXEL, (uv.getY(i) * GROUND_EXTENT) / GROUND_TEXEL);
  return lawn;
}

/** Height of the natural ground. Paved slabs and overlays sit just above it. */
export const GROUND_LEVEL = -0.03;

export function buildJungle(
  root: THREE.Group,
  models: Models,
  map: MapDefinition,
  state: Readonly<GameSnapshot>,
) {
  const size = state.size,
    half = (size * TILE_SIZE) / 2,
    at = (cell: number) => (cell - (size - 1) / 2) * TILE_SIZE;

  // One texel per cell: bright where the map says mud. Filtering and noise in the shader soften it.
  const data = new Uint8Array(size * size * 4);
  for (let z = 0; z < size; z++)
    for (let x = 0; x < size; x++) data[(z * size + x) * 4] = groundAt(map, x, z) === "mud" ? 255 : 0;
  const mask = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  mask.magFilter = mask.minFilter = THREE.LinearFilter;
  mask.needsUpdate = true;
  const ground = new THREE.Mesh(
    groundGeometry(),
    models.materials.soil(mask, [-half, -half, size * TILE_SIZE, size * TILE_SIZE]),
  );
  ground.position.y = GROUND_LEVEL;
  ground.receiveShadow = true;
  root.add(ground);

  const blades = models.materials.grass(),
    geometry = tuftGeometry();
  const plant = (x: number, z: number, scale: number, turn: number) => {
    const mesh = new THREE.Mesh(geometry, blades);
    mesh.position.set(x, GROUND_LEVEL, z);
    mesh.rotation.y = turn;
    mesh.scale.set(scale, scale * (0.8 + hash(Math.round(x * 9), Math.round(z * 9), 6) * 0.5), scale);
    mesh.receiveShadow = true;
    root.add(mesh);
  };
  for (let z = 0; z < size; z++)
    for (let x = 0; x < size; x++) {
      if (groundAt(map, x, z) !== "grass" || state.tiles[z][x] === 1) continue;
      for (let i = 0; i < 10; i++)
        plant(
          at(x) + (hash(x, z, 10 + i) - 0.5) * TILE_SIZE,
          at(z) + (hash(x, z, 30 + i) - 0.5) * TILE_SIZE,
          0.8 + hash(x, z, 50 + i) * 0.9,
          hash(x, z, 70 + i) * 6.28,
        );
    }

  // The forest around the grid, walked as rings of tiles outside the boundary wall.
  const stand = (
    id: Parameters<Models["scenery"]>[0],
    x: number,
    z: number,
    scale: number,
    turn: number,
    shadows: boolean,
  ) => {
    const model = models.scenery(id);
    model.position.set(x, GROUND_LEVEL, z);
    model.rotation.y = turn;
    model.scale.setScalar(scale);
    model.traverse((part) => {
      if (part instanceof THREE.Mesh) {
        part.castShadow = shadows;
        part.receiveShadow = shadows;
      }
    });
    root.add(model);
  };
  const reach = 15;
  for (let z = -reach; z < size + reach; z++)
    for (let x = -reach; x < size + reach; x++) {
      // Rings outside the boundary wall: 1 is the first tile beyond it.
      const ring = Math.max(-x, -z, x - (size - 1), z - (size - 1));
      if (ring < 1) continue;
      const jitterX = at(x) + (hash(x, z, 1) - 0.5) * TILE_SIZE * 0.8,
        jitterZ = at(z) + (hash(x, z, 2) - 0.5) * TILE_SIZE * 0.8,
        roll = hash(x, z, 3),
        turn = hash(x, z, 4) * 6.28,
        vary = hash(x, z, 5);
      if (ring <= 3) {
        if (roll < 0.42) stand("undergrowth", jitterX, jitterZ, 0.8 + vary * 0.7, turn, false);
        else if (roll < 0.5 && ring >= 2) stand("palm-tree", jitterX, jitterZ, 0.8 + vary * 0.4, turn, false);
      } else if (ring <= 7) {
        // Tall trees keep their distance, so the overhead view never looks through a crown.
        if (roll < 0.1 && (x + z) % 2 === 0)
          stand("canopy-tree", jitterX, jitterZ, 0.85 + vary * 0.4, turn, false);
        else if (roll < 0.24) stand("undergrowth", jitterX, jitterZ, 0.9 + vary * 0.8, turn, false);
        else if (roll < 0.3) stand("palm-tree", jitterX, jitterZ, 0.9 + vary * 0.5, turn, false);
      } else if (roll < 0.11) stand("canopy-tree-far", jitterX, jitterZ, 0.9 + vary * 0.7, turn, false);
    }
}
