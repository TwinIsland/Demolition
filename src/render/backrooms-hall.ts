import * as THREE from "three";
import { TILE_SIZE } from "../core/geometry";
import type { GameSnapshot } from "../core/types";
import { BACKROOMS_CEILING, type Models } from "./models";

/**
 * Everything an office floor has besides walls and furniture: one carpet from wall to wall, the
 * suspended ceiling with its light panels, and more of the same rooms past the boundary wall.
 *
 * The boundary wall reaches the ceiling, so from inside nothing beyond it shows. The rooms outside
 * are there for the overhead view, which looks down through the one-sided ceiling.
 */

/** Cells of carpet and stray walls beyond the boundary wall on every side. */
const REACH = 7;
/** The carpet lies where the top of a floor slab would be. */
const FLOOR_LEVEL = -0.01;

let unit: THREE.PlaneGeometry | undefined;
/** A 1 x 1 square in the XZ plane, facing up. */
function square() {
  if (!unit) {
    unit = new THREE.PlaneGeometry(1, 1);
    unit.rotateX(-Math.PI / 2);
  }
  return unit;
}

const hash = (x: number, z: number) =>
  ((Math.imul(x * 73856093 + z * 19349663, 83492791) >>> 0) % 1000) / 1000;

const PANEL_COLOR = "#fff0c0",
  PANEL_GAIN = 1.55;
/** Seconds the floor stays dark after the rooms have moved, and seconds the tubes take to restrike. */
const BLACKOUT = 0.3,
  RESTRIKE = 0.5;

/**
 * How bright the ceiling panels are, 0 to 1. They stutter while the map counts down to moving its
 * rooms, more often as the moment comes, go out when it happens and restrike just after.
 * `motion` is the player's motion setting: at 0 the lights stay steady.
 */
export function lampLevel(state: Readonly<GameSnapshot>, motion: number) {
  const reset = state.terrainReset;
  if (!reset?.shift || motion <= 0) return 1;
  if (reset.completedAt !== undefined) {
    const age = state.time - reset.completedAt;
    return age < BLACKOUT ? 0.1 : Math.min(1, 0.1 + (0.9 * (age - BLACKOUT)) / RESTRIKE);
  }
  const left = reset.at - state.time,
    urgency = 1 - Math.min(1, Math.max(0, left / 4));
  // Six steps a second, so at most three dips a second: a stutter, not a strobe.
  const step = Math.floor(state.time * 6);
  if (step % 2 || hash(step, reset.id) > 0.3 + 0.5 * urgency) return 1;
  return 1 - (0.3 + 0.25 * urgency) * motion;
}

/** Set the brightness of every ceiling panel at once; they share one material. */
export function dimPanels(models: Models, level: number) {
  models.materials
    .lamp(PANEL_COLOR, PANEL_GAIN)
    .color.set(PANEL_COLOR)
    .multiplyScalar(PANEL_GAIN * level);
}

/** A light panel hangs over every cell whose column and row are both odd. */
export const hasPanel = (x: number, z: number) => x % 2 !== 0 && z % 2 !== 0;

export function buildBackrooms(root: THREE.Group, models: Models, state: Readonly<GameSnapshot>) {
  const size = state.size,
    width = size * TILE_SIZE,
    extent = (size + REACH * 2) * TILE_SIZE,
    at = (cell: number) => (cell - (size - 1) / 2) * TILE_SIZE;
  // The surface shader paints the lamp pools on a fixed lattice, which lines up with the panels
  // only when the middle cell is an even number of cells from the edge.
  if (((size - 1) / 2) % 2) console.warn("Backrooms lamp pools are out of step with this map size");
  const sheet = (material: THREE.Material, y: number, w: number, d: number, x = 0, z = 0) => {
    const mesh = new THREE.Mesh(square(), material);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, 1, d);
    root.add(mesh);
    return mesh;
  };

  sheet(models.backroomsCarpet(), FLOOR_LEVEL, extent, extent).receiveShadow = true;

  // The ceiling faces down only, so the overhead view looks straight through it.
  sheet(models.backroomsCeiling(), BACKROOMS_CEILING, width, width).rotation.x = Math.PI;
  const panel = models.materials.lamp(PANEL_COLOR, PANEL_GAIN);
  for (let z = 1; z < size - 1; z++)
    for (let x = 1; x < size - 1; x++)
      if (hasPanel(x, z))
        // One ceiling tile wide, inside its grid.
        sheet(panel, BACKROOMS_CEILING - 0.015, 1.1, 1.1, at(x), at(z)).rotation.x = Math.PI;

  // Outside: the same maze goes on. Short runs of wall, thinning out with distance.
  for (let z = -REACH; z < size + REACH; z++)
    for (let x = -REACH; x < size + REACH; x++) {
      if (x >= -1 && z >= -1 && x <= size && z <= size) continue;
      const run = hash(Math.floor(x / 3), z) < 0.34 || hash(x, Math.floor(z / 3) + 57) < 0.3;
      if (!run || hash(x + 11, z + 5) < 0.18) continue;
      const wall = models.wall("backrooms");
      wall.position.set(at(x), 0, at(z));
      wall.traverse((part) => {
        if (part instanceof THREE.Mesh) part.castShadow = false;
      });
      root.add(wall);
    }
}
