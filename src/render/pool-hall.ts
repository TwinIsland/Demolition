import * as THREE from "three";
import { TILE_SIZE } from "../core/geometry";
import type { GameSnapshot } from "../core/types";
import { POOL_CEILING, type Models } from "./models";

/**
 * Everything a tiled hall has besides walls and obstacles: the pool lining and the water that
 * stands over it, the ceiling with its light panels, and the colonnade that carries on past the
 * boundary wall until the haze takes it.
 *
 * Deck cells are slabs the arena lays at floor level. Wherever there is no slab the lining shows
 * 18 cm lower, under one sheet of water that spans the whole hall just below the deck, so
 * overlays drawn on the floor never fight with it.
 */

/** Cells of hall beyond the boundary wall on every side. */
const REACH = 12;
/** Columns stand on every fourth cell, inside the arena and out. */
export const COLUMN_PITCH = 4;
export const WATER_LEVEL = -0.03;
const LINING_LEVEL = -0.19;

let unit: THREE.PlaneGeometry | undefined;
/** A 1 x 1 square in the XZ plane, facing up. */
function square() {
  if (!unit) {
    unit = new THREE.PlaneGeometry(1, 1);
    unit.rotateX(-Math.PI / 2);
  }
  return unit;
}

let standing: THREE.PlaneGeometry | undefined;
/** A 1 x 1 square in the XY plane, facing +Z. */
const upright = () => (standing ??= new THREE.PlaneGeometry(1, 1));

export function buildPoolHall(root: THREE.Group, models: Models, state: Readonly<GameSnapshot>) {
  const size = state.size,
    extent = (size + REACH * 2) * TILE_SIZE,
    at = (cell: number) => (cell - (size - 1) / 2) * TILE_SIZE;
  const m = models.materials;
  const sheet = (material: THREE.Material, y: number, width: number, depth: number, x = 0, z = 0) => {
    const mesh = new THREE.Mesh(square(), material);
    mesh.position.set(x, y, z);
    mesh.scale.set(width, 1, depth);
    root.add(mesh);
    return mesh;
  };

  sheet(
    m.standard("pool-floor", "#a9c3c8", "ceramic", "pool-mosaic"),
    LINING_LEVEL,
    extent,
    extent,
  ).receiveShadow = true;
  sheet(m.water(), WATER_LEVEL, extent, extent);

  // The ceiling faces down only, so the overhead view looks straight through it.
  const ceiling = sheet(m.standard("pool-ceiling", "#aeb9b9"), POOL_CEILING, extent, extent);
  ceiling.rotation.x = Math.PI;
  const panel = m.lamp("#f1fdff", 1.5);
  for (let z = -REACH; z < size + REACH; z++)
    for (let x = -REACH; x < size + REACH; x++) {
      // A panel over every second cell, except where a column meets the ceiling.
      if (x % 2 || z % 2 || (x % COLUMN_PITCH === 0 && z % COLUMN_PITCH === 0)) continue;
      sheet(panel, POOL_CEILING - 0.02, 1.5, 1.5, at(x), at(z)).rotation.x = Math.PI;
    }

  // Columns outside the grid. The boundary wall carries its own, so the first row stands clear.
  for (let z = -REACH; z < size + REACH; z++)
    for (let x = -REACH; x < size + REACH; x++) {
      if (x % COLUMN_PITCH || z % COLUMN_PITCH) continue;
      if (x >= 0 && z >= 0 && x < size && z < size) continue;
      const column = models.wall("poolrooms", "pillar");
      column.position.set(at(x), 0, at(z));
      column.traverse((part) => {
        if (part instanceof THREE.Mesh) part.castShadow = false;
      });
      root.add(column);
    }

  // Four walls close the hall. Each has tall openings with nothing but light behind them.
  const edge = extent / 2,
    doorway = m.lamp("#f6ffff", 1.2);
  for (let side = 0; side < 4; side++) {
    const turn = (side * Math.PI) / 2,
      along = new THREE.Vector3(Math.cos(turn), 0, -Math.sin(turn)),
      out = new THREE.Vector3(Math.sin(turn), 0, Math.cos(turn));
    const wall = models.box(extent, POOL_CEILING + 0.4, 1, models.poolTile(), 0.003);
    wall.position.copy(out).multiplyScalar(edge + 0.5);
    wall.position.y = POOL_CEILING / 2 - 0.2;
    wall.rotation.y = turn;
    wall.castShadow = false;
    root.add(wall);
    for (let cell = -REACH + 2; cell < size + REACH; cell += COLUMN_PITCH * 2) {
      // An upright plane faces +Z; turned half a circle past the wall's own turn it faces the hall.
      const door = new THREE.Mesh(upright(), doorway);
      door.rotation.y = turn + Math.PI;
      door.scale.set(TILE_SIZE, 3.6, 1);
      door.position
        .copy(along)
        .multiplyScalar(at(cell))
        .addScaledVector(out, edge - 0.02);
      door.position.y = 1.8 + WATER_LEVEL;
      root.add(door);
    }
  }
}
