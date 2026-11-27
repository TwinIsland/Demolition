import * as THREE from "three";
import { TILE_SIZE } from "../core/geometry";
import { groundAt, type MapDefinition } from "../core/pack-api";
import type { GameSnapshot } from "../core/types";
import { JUNGLE_RAIN_SKY } from "./environment/sky-look";
import { shaftGeometry } from "./jungle-flora";
import type { Models } from "./models";

/**
 * Everything a rainforest arena has besides walls and obstacles: one continuous ground of grass,
 * fallen leaves and mud, tufts of grass, shafts of sunlight, and the forest around the grid.
 *
 * All of it is added as plain meshes, so the arena's static batches turn it into a few instanced
 * draws per chunk. Level of detail is by distance from the grid: undergrowth and full trees at
 * the edge, simpler trees further out, where the mist hides the difference. Grass blades flatten
 * themselves in the vertex shader beyond 34 metres.
 *
 * The overhead views must see the whole board. Trees that could lean over it lose their crowns
 * there and are cut off at wall height; see the `trunk` and `canopy` surface profiles.
 */

/** Stable 0..1 hash of a cell and a salt, so scenery never changes between rebuilds of a map. */
const hash = (x: number, z: number, salt: number) => {
  let n = Math.imul(x * 374761393 + z * 668265263 + salt * 2147483647, 1274126177);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};

let tuft: THREE.BufferGeometry | undefined;
/** A patch of tapered blades. Normals point up so tufts shade like the ground they stand on. */
function tuftGeometry() {
  if (tuft) return tuft;
  const positions: number[] = [],
    normals: number[] = [],
    colors: number[] = [];
  // Dark at the root, where blades shade each other, and never brighter than a sunlit leaf.
  const root = new THREE.Color("#3b5224"),
    tip = new THREE.Color("#8aa650");
  const blades = 16;
  for (let i = 0; i < blades; i++) {
    const turn = (i / blades) * Math.PI * 2 + hash(i, 3, 1) * 0.8,
      reach = 0.03 + hash(i, 5, 2) * 0.22,
      height = 0.1 + hash(i, 7, 3) * 0.2,
      width = 0.005 + hash(i, 9, 4) * 0.006,
      lean = 0.02 + hash(i, 11, 5) * 0.09;
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

const UNDERGROWTH = [
  // Scan, smallest scale, extra scale. The scans are of knee-high plants; a rainforest's are not.
  ["fern-a", 1.6, 1.4],
  ["fern-b", 1.6, 1.4],
  ["fern-c", 2.0, 1.6],
  ["calathea-a", 2.2, 1.8],
  ["calathea-b", 2.6, 2.0],
  ["anthurium-a", 2.4, 2.4],
  ["anthurium-b", 2.6, 2.4],
  ["shrub-a", 3.0, 2.5],
  ["shrub-b", 3.0, 2.5],
] as const;

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

  const stand = (
    model: THREE.Object3D,
    x: number,
    z: number,
    scale: number,
    turn: number,
    shadows: boolean,
  ) => {
    model.position.set(x, GROUND_LEVEL, z);
    model.rotation.y = turn;
    model.scale.multiplyScalar(scale);
    model.traverse((part) => {
      if (!(part instanceof THREE.Mesh)) return;
      part.castShadow = shadows;
      // Crowns stay unshadowed either way.
      part.receiveShadow = part.receiveShadow && shadows;
    });
    root.add(model);
  };
  // The forest around the grid, walked as rings of tiles outside the boundary wall.
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
        vary = hash(x, z, 5),
        variant = Math.floor(hash(x, z, 6) * 3);
      if (ring <= 4) {
        // The edge of the clearing: a wall of undergrowth under trees that lean over the board.
        if (roll < 0.14 && ring >= 2)
          stand(models.jungleTree(variant, "near", false), jitterX, jitterZ, 0.9 + vary * 0.3, turn, true);
        else if (roll < 0.2 && ring >= 2)
          stand(models.palm(), jitterX, jitterZ, 0.8 + vary * 0.5, turn, false);
        else if (roll < (ring <= 2 ? 0.74 : 0.5)) {
          const [id, base, extra] = UNDERGROWTH[Math.floor(hash(x, z, 7) * UNDERGROWTH.length)];
          stand(models.scenery(id), jitterX, jitterZ, base + vary * extra, turn, false);
        } else if (roll < 0.8)
          stand(
            models.scenery(
              (["rock-a", "rock-b", "rock-c", "rock-d"] as const)[variant + (vary < 0.3 ? 1 : 0)],
            ),
            jitterX,
            jitterZ,
            0.5 + vary * 0.7,
            turn,
            false,
          );
      } else if (ring <= 8) {
        if (roll < 0.17)
          stand(models.jungleTree(variant, "near", true), jitterX, jitterZ, 0.95 + vary * 0.45, turn, false);
        else if (roll < 0.22) stand(models.palm(), jitterX, jitterZ, 0.9 + vary * 0.6, turn, false);
        else if (roll < 0.3) {
          const [id, base, extra] = UNDERGROWTH[Math.floor(hash(x, z, 7) * UNDERGROWTH.length)];
          stand(models.scenery(id), jitterX, jitterZ, (base + vary * extra) * 1.3, turn, false);
        }
      } else if (roll < 0.2)
        stand(models.jungleTree(variant, "far", true), jitterX, jitterZ, 1 + vary * 0.6, turn, false);
    }

  // Sunlight breaks through wherever the canopy has a gap. The columns lean with the sun.
  const sun = new THREE.Vector3(...(JUNGLE_RAIN_SKY.sun.from ?? [0, 1, 0])).normalize(),
    lean = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), sun),
    spin = new THREE.Quaternion(),
    beams = models.materials.shafts(),
    column = shaftGeometry();
  for (let z = -3; z < size + 3; z += 3)
    for (let x = -3; x < size + 3; x += 3) {
      if (hash(x, z, 90) > 0.32) continue;
      const beam = new THREE.Mesh(column, beams);
      beam.position.set(
        at(x) + (hash(x, z, 91) - 0.5) * TILE_SIZE * 3,
        -0.6,
        at(z) + (hash(x, z, 92) - 0.5) * TILE_SIZE * 3,
      );
      beam.quaternion
        .copy(lean)
        .multiply(spin.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash(x, z, 93) * 3.14));
      const width = 2.2 + hash(x, z, 94) * 3.4;
      beam.scale.set(width, 17 + hash(x, z, 95) * 6, width);
      // Drawn after the opaque scene and the rain, and never part of a shadow.
      beam.renderOrder = 2;
      root.add(beam);
    }
}
