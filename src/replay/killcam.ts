import type { GameEvent, GameSnapshot, Player, Vec2 } from "../core/types";

/** Seconds of match shown before the kill, and after it. */
const LEAD = 2.6;
const TAIL = 0.8;
/** The shortest lead worth showing; a match that young has nothing to replay. */
const MIN_LEAD = 0.7;
/** Playback rate at the kill itself. */
const SLOW_RATE = 0.22;
/** World units per cell, as the renderer lays the arena out. */
const CELL = 2.4;
/** Tallest thing the close camera may have to look over, with some margin. */
const WALL_TOP = 3;
/** Lowest the close camera goes: above the flames of a blast, which stand about 2.6 high. */
const BLAST_TOP = 4.4;

/** Where the replay camera is for one frame. Cells for the ground position, world units for the rest. */
export interface ReplayShot {
  /** Cell the camera looks at, and the height above the floor it aims for. */
  focus: Vec2;
  focusHeight: number;
  /** Bearing from the focus to the camera: 0 is +z, a quarter turn is +x. */
  azimuth: number;
  /** Ground distance from the focus, and height above the floor. */
  distance: number;
  height: number;
  fov: number;
  roll: number;
  /** 0..1 camera shake from the blast. */
  shake: number;
  /** 0..1 strength of the slow-motion lens: depth of field, fringing and grade. */
  grade: number;
}

export interface KillcamFrame {
  state: Readonly<GameSnapshot>;
  shot: ReplayShot;
  /** Playback rate right now, 1 being real time. */
  rate: number;
  /** 0..1 of the replay's running time. */
  progress: number;
  /** Events the replay passed since the previous frame, for the slowed sound. */
  cues: readonly GameEvent[];
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (from: number, to: number, value: number) => {
  const t = clamp01((value - from) / (to - from));
  return t * t * (3 - 2 * t);
};

/** The operator who fell last: the subject of the final kill. */
export function lastFallen(state: Readonly<GameSnapshot>): Player | undefined {
  let last: Player | undefined;
  for (const p of state.players)
    if (!p.alive && p.stats?.diedAt !== undefined && p.stats.diedAt >= (last?.stats?.diedAt ?? -Infinity))
      last = p;
  return last;
}

/**
 * Directs one slow-motion replay of an elimination from recorded frames: maps real time onto
 * match time (full speed, then slowing into the kill), rebuilds the snapshot for that moment and
 * flies a camera from a high wide view down to a close one beside the victim.
 */
export class Killcam {
  readonly killerId?: string;
  private readonly killTime: number;
  private readonly start: number;
  private readonly end: number;
  /** Real seconds the whole replay takes. */
  readonly duration: number;
  private readonly restCell: Vec2;
  private readonly close: { azimuth: number; distance: number; height: number; orbit: number };
  private time: number;
  private elapsed = 0;
  private cursor = 0;
  private heard: number;

  /** Returns nothing when the frames do not hold enough of the victim's last moments. */
  static plan(frames: readonly Readonly<GameSnapshot>[], victimId: string): Killcam | undefined {
    const victim = frames.at(-1)?.players.find((p) => p.id === victimId);
    const killTime = victim?.stats?.diedAt;
    if (!victim || victim.alive || killTime === undefined) return undefined;
    if (killTime - Math.max(frames[0].time, killTime - LEAD) < MIN_LEAD) return undefined;
    return new Killcam(frames, victim, killTime);
  }

  private constructor(
    private readonly frames: readonly Readonly<GameSnapshot>[],
    private readonly victim: Readonly<Player>,
    killTime: number,
  ) {
    const last = frames[frames.length - 1];
    this.killTime = killTime;
    this.start = Math.max(frames[0].time, killTime - LEAD);
    this.end = killTime + TAIL;
    this.time = this.heard = this.start;
    // A kill by another operator is logged under the killer; zombies and the zone log the victim.
    const kill = last.events.find(
      (e) => e.type === "kill" && Math.abs(e.at - killTime) < 1e-6 && e.playerId !== victim.id,
    );
    this.killerId = kill?.playerId;
    this.restCell = { x: victim.x, z: victim.z };
    this.close = this.closeShot(last);
    let duration = 0;
    for (let t = this.start; t < this.end; t += this.rate(t) / 120) duration += 1 / 120;
    this.duration = duration;
  }

  /** True while the terrain at the start of the clip is not the terrain of its last frame. */
  get terrainChanges() {
    return this.frames[0].tiles !== this.frames[this.frames.length - 1].tiles;
  }

  /** Moves the replay on by `dt` real seconds. Returns true once it has run out. */
  advance(dt: number): boolean {
    this.elapsed += dt;
    this.time = Math.min(this.end, this.time + dt * this.rate(this.time));
    return this.time >= this.end;
  }

  frame(): KillcamFrame {
    const state = this.sample(this.time);
    const from = this.heard;
    this.heard = this.time;
    return {
      state,
      shot: this.shot(state),
      rate: this.rate(this.time),
      progress: clamp01(this.elapsed / this.duration),
      cues: state.events.filter((e) => e.at > from && e.at <= this.time),
    };
  }

  /** Full speed first, easing down into the kill, then picking up a little on the way out. */
  private rate(time: number) {
    const k = this.killTime;
    const slow = smooth(k - 1, k - 0.25, time) * (1 - 0.55 * smooth(k + 0.3, this.end, time));
    return mix(1, SLOW_RATE, slow);
  }

  /** The snapshot at `time`: the recorded frame before it, with whatever walks moved on between frames. */
  private sample(time: number): Readonly<GameSnapshot> {
    const { frames } = this;
    while (this.cursor + 1 < frames.length && frames[this.cursor + 1].time <= time) this.cursor++;
    const a = frames[this.cursor],
      b = frames[this.cursor + 1];
    // Past the last frame only the clock runs on: blasts burn out and the fallen stay down.
    if (!b || time <= a.time) return { ...a, time: Math.max(time, a.time) };
    const alpha = (time - a.time) / (b.time - a.time);
    return {
      ...a,
      time,
      players: a.players.map((p) => {
        const q = b.players.find((other) => other.id === p.id);
        // A respawn or a blink is a cut, not a slide.
        if (!q || Math.hypot(q.x - p.x, q.z - p.z) > 1.5) return p;
        const turn = Math.atan2(Math.sin(q.yaw - p.yaw), Math.cos(q.yaw - p.yaw));
        return {
          ...p,
          x: mix(p.x, q.x, alpha),
          z: mix(p.z, q.z, alpha),
          elevation: mix(p.elevation, q.elevation, alpha),
          yaw: p.yaw + turn * alpha,
        };
      }),
      zombies: a.zombies.map((zombie) => {
        const next = b.zombies.find((other) => other.id === zombie.id);
        return next
          ? { ...zombie, x: mix(zombie.x, next.x, alpha), z: mix(zombie.z, next.z, alpha) }
          : zombie;
      }),
    };
  }

  private shot(state: Readonly<GameSnapshot>): ReplayShot {
    const k = this.killTime,
      time = state.time;
    // 0 on the wide establishing view, 1 on the close one.
    const near = smooth(k - 1.4, k - 0.3, time);
    const after = clamp01((time - k) / TAIL);
    const victim = state.players.find((p) => p.id === this.victim.id) ?? this.victim;
    const killer = state.players.find((p) => p.id === this.killerId);
    const focus = { x: victim.x, z: victim.z };
    let spread = 0;
    if (killer) {
      // The wide view frames both; a killer far away only pulls the frame part of the way.
      const dx = killer.x - victim.x,
        dz = killer.z - victim.z,
        gap = Math.hypot(dx, dz),
        reach = Math.min(gap, 5) / (gap || 1);
      spread = Math.min(gap, 5);
      focus.x += dx * reach * 0.5 * (1 - near);
      focus.z += dz * reach * 0.5 * (1 - near);
    }
    const { close } = this;
    return {
      focus,
      focusHeight: mix(0.5, mix(1.05, 0.45, smooth(0.1, 0.8, after)), near),
      // The swing round finishes while the camera is still above the walls; the descent comes last.
      azimuth:
        close.azimuth -
        0.8 * (1 - smooth(k - 1.6, k - 0.8, time)) +
        close.orbit * (this.elapsed / this.duration - 0.5),
      distance: mix(8 + spread * CELL * 0.35, close.distance, near) * (1 - 0.1 * after),
      height: mix(9.5, close.height, near * near),
      fov: mix(52, 40, near),
      roll: 0.035 * near,
      shake: time >= k ? Math.exp(-7 * (time - k)) : 0,
      grade: near,
    };
  }

  /**
   * The close view: over the longest open lane from where the victim fell, craned up until the
   * walls around no longer hide the body. It never comes down to eye level: the open lanes are
   * the ones the blast runs along. The side away from the killer is preferred, so the shot looks
   * past one at the other.
   */
  private closeShot(state: Readonly<GameSnapshot>) {
    const { x, z } = this.restCell;
    const killer = state.players.find((p) => p.id === this.killerId);
    const towardKiller = killer ? Math.atan2(killer.x - x, killer.z - z) : undefined;
    const open = (cx: number, cz: number) => state.tiles[Math.round(cz)]?.[Math.round(cx)] === 0;
    /** Cells of open floor from the victim along `azimuth`, wide enough for a camera. */
    const lane = (azimuth: number) => {
      const sx = Math.sin(azimuth),
        sz = Math.cos(azimuth);
      let reach = 0.5;
      for (; reach < 3; reach += 0.1) {
        const px = x + sx * reach,
          pz = z + sz * reach;
        if (!open(px, pz) || !open(px + sz * 0.28, pz - sx * 0.28) || !open(px - sz * 0.28, pz + sx * 0.28))
          break;
      }
      return reach;
    };
    let best = { azimuth: 0, reach: 0, score: -Infinity };
    for (let i = 0; i < 16; i++) {
      const azimuth = (i * Math.PI) / 8,
        reach = lane(azimuth);
      const score = reach + (towardKiller === undefined ? 0 : 0.25 * (1 - Math.cos(azimuth - towardKiller)));
      if (score > best.score) best = { azimuth, reach, score };
    }
    const clear = best.reach * CELL;
    // The sight line has to pass over a wall standing `clear` away from the victim.
    const distance = Math.min(4.6, (8.5 * clear) / (WALL_TOP - 0.6));
    return {
      azimuth: best.azimuth,
      distance,
      height: Math.max(BLAST_TOP, 1 + ((WALL_TOP - 0.6) * distance) / clear),
      orbit: 0.5,
    };
  }
}
