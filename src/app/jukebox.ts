import { MUSIC_BOX_TRACKS } from "../audio/music-player";
import { MAPS } from "../core/maps";
import type { GameSnapshot, Player, Vec2 } from "../core/types";
import { ringOf } from "../core/zone";

/** Cells between the player and the block's middle at which a click still reaches it. */
const REACH = 2.2;
/** In the overhead view there is no aim: standing next to it is enough. */
const BOARD_REACH = 1.6;
/** Cosine of the widest angle between the sight line and the block that still counts as aimed at it. */
const AIM = 0.9;
/** Seconds the new track's name stays up after a change, wherever the player has gone. */
const ANNOUNCE = 3.5;

export interface JukeboxPrompt {
  readonly title: string;
  readonly artist: string;
  /** True while a click would change the track. */
  readonly reachable: boolean;
}

/**
 * The jukebox a map may stand on one of its cells (`featureAt` names it "jukebox"). A click on it
 * steps the match's music through the story soundtrack of the music box. Only the local player
 * hears it: the simulation knows nothing of it.
 */
export class Jukebox {
  private mapId = "";
  private cell?: Vec2;
  private playing = "";
  private changedAt = -Infinity;

  constructor(private readonly play: (url: string) => void) {}

  /** A match starts on `track`: the first click moves on from there. */
  reset(track: string) {
    this.playing = track;
    this.changedAt = -Infinity;
  }

  private locate(state: Readonly<GameSnapshot>) {
    if (state.mapId !== this.mapId) {
      this.mapId = state.mapId;
      this.cell = undefined;
      const map = MAPS.find((entry) => entry.id === state.mapId);
      if (map?.featureAt)
        for (let z = 1; z < state.size - 1 && !this.cell; z++)
          for (let x = 1; x < state.size - 1; x++)
            if (map.featureAt(x, z, state.size) === "jukebox") {
              this.cell = { x, z };
              break;
            }
    }
    // The closing zone walls the block up with everything else.
    return this.cell && ringOf(state.size, this.cell) > (state.zone?.closed ?? 0) ? this.cell : undefined;
  }

  private reachable(state: Readonly<GameSnapshot>, viewer: Player, yaw: number, topDown: boolean) {
    const cell = this.locate(state);
    if (!cell || !viewer.alive || state.phase !== "playing") return false;
    const dx = cell.x - viewer.x,
      dz = cell.z - viewer.z,
      distance = Math.hypot(dx, dz);
    if (topDown) return distance <= BOARD_REACH;
    return distance <= REACH && (-Math.sin(yaw) * dx - Math.cos(yaw) * dz) / (distance || 1) >= AIM;
  }

  /** Takes the click when it lands on the jukebox, and moves on to the next track. */
  use(state: Readonly<GameSnapshot>, viewer: Player, yaw: number, topDown: boolean, now: number) {
    if (!this.reachable(state, viewer, yaw, topDown)) return false;
    const current = MUSIC_BOX_TRACKS.findIndex((track) => track.url === this.playing);
    this.playing = MUSIC_BOX_TRACKS[(current + 1) % MUSIC_BOX_TRACKS.length].url;
    this.changedAt = now;
    this.play(this.playing);
    return true;
  }

  /** What the HUD shows: the track and whether a click would change it. Nothing away from the block. */
  prompt(
    state: Readonly<GameSnapshot>,
    viewer: Player,
    yaw: number,
    topDown: boolean,
    now: number,
  ): JukeboxPrompt | undefined {
    const reachable = this.reachable(state, viewer, yaw, topDown);
    if (!reachable && now - this.changedAt > ANNOUNCE) return undefined;
    const track = MUSIC_BOX_TRACKS.find((entry) => entry.url === this.playing);
    if (!track && !reachable) return undefined;
    return { title: track?.title ?? "", artist: track?.artist ?? "", reachable };
  }
}
