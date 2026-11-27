import type { GameSnapshot } from "../core/types";

/** Seconds of match kept for the killcam. */
const WINDOW = 6;
/** Seconds between recorded frames; playback interpolates what moves in between. */
const INTERVAL = 1 / 30;

type Terrain = Pick<GameSnapshot, "tiles" | "coverOrigins" | "wallOrigins">;

/**
 * Rolling record of the last few seconds of a match, for the killcam. Each frame is a deep copy
 * of the snapshot, so the simulation can keep mutating its own. The grid is copied only when it
 * changes: frames between two changes share one copy, which is also how a clip tells whether
 * its terrain differs from the present one.
 */
export class ReplayRecorder {
  private frames: GameSnapshot[] = [];
  private terrain?: Terrain & { key: number };

  clear() {
    this.frames = [];
    this.terrain = undefined;
  }

  /** Records `state` if it is due. `force` records it regardless: the moment a clip ends on. */
  capture(state: Readonly<GameSnapshot>, force = false) {
    const last = this.frames.at(-1);
    // A new match, or a clock that went back: nothing recorded belongs to this one.
    if (last && (last.seed !== state.seed || last.mapId !== state.mapId || state.time < last.time))
      this.clear();
    else if (last && state.time === last.time) return;
    else if (last && !force && state.time - last.time < INTERVAL - 1e-4) return;

    const { tiles, coverOrigins, wallOrigins, ...rest } = state;
    let key = state.coverRevision ?? 0;
    for (const row of tiles) for (const tile of row) key = (Math.imul(key, 31) + tile) | 0;
    if (this.terrain?.key !== key)
      this.terrain = {
        key,
        tiles: tiles.map((row) => row.slice()),
        coverOrigins: coverOrigins && { ...coverOrigins },
        wallOrigins: wallOrigins && { ...wallOrigins },
      };
    const frame: GameSnapshot = {
      ...structuredClone(rest),
      tiles: this.terrain.tiles,
      coverOrigins: this.terrain.coverOrigins,
      wallOrigins: this.terrain.wallOrigins,
    };
    this.frames.push(frame);
    const oldest = state.time - WINDOW;
    let drop = 0;
    while (this.frames[drop].time < oldest) drop++;
    if (drop) this.frames.splice(0, drop);
  }

  /** The recorded frames from `from` (simulation time) to the newest, oldest first. */
  clip(from: number): readonly Readonly<GameSnapshot>[] {
    const start = this.frames.findIndex((frame) => frame.time >= from);
    return start < 0 ? [] : this.frames.slice(start);
  }
}
