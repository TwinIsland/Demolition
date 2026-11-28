import type { PropChange } from "./rpg/map";
import { openWorld } from "./rpg/world";
import type { Hotspot, RoomScene } from "./script";

export interface Room {
  /** Walking direction; (0, 0) stands still. Ignored while `frozen`. */
  move(x: number, y: number): void;
  frozen: boolean;
  /** The hotspot in reach: the nearest, with what he faces counting as nearer. */
  readonly facing: Hotspot | undefined;
  /** Stops the room's clock while set. */
  paused: boolean;
  /** Shows, hides or animates the prop with this id. */
  set(id: string, change: PropChange): void;
  dispose(): void;
}

/**
 * Runs a walkable 8-bit room on `canvas`: the scene's map, with its hotspots opened by the props
 * that name them. `onFacing` reports the hotspot in reach whenever it changes.
 */
export const openRoom = (
  canvas: HTMLCanvasElement,
  scene: Pick<RoomScene, "map" | "hotspots">,
  onFacing: (hotspot: Hotspot | undefined) => void,
  sprite?: "zero" | "zero-bare",
): Room => openWorld(canvas, scene.map, scene.hotspots, onFacing, sprite);
