import type { GameSnapshot, Player, Tile, Vec2 } from "../../core/types";
import type { Line } from "../script";
import type { Stage, StoryMatch } from "../stage";

/**
 * What an act staged on the real game is written against: the match, the stage, and the handful
 * of verbs a script needs. Every promise resolves false once the story has been closed, so a
 * script reads `if (!(await d.until(...))) return;` from top to bottom.
 */
export interface Director {
  readonly stage: Stage;
  readonly match: StoryMatch;
  readonly state: Readonly<GameSnapshot>;
  readonly hero: Readonly<Player>;
  actor(id: string): Readonly<Player>;
  /** Resolves on the first frame `test` holds. */
  until(test: (state: Readonly<GameSnapshot>) => boolean): Promise<boolean>;
  /** Waits in match time, which stands still during a conversation. */
  seconds(amount: number): Promise<boolean>;
  talk(lines: readonly Line[], options?: { live?: boolean }): Promise<boolean>;
  /** Takes the keyboard off the hero while the world keeps running. */
  lock(on: boolean): void;
  /** Stands someone on a cell at once. */
  put(id: string, cell: Vec2, yaw?: number): void;
  /** Glides someone to a cell in a straight line, through anything: for staging, not for play. */
  walk(id: string, to: Vec2, speed?: number): Promise<boolean>;
  /** Turns someone towards a cell or another member of the cast. */
  face(id: string, target: Vec2): void;
  /** Brings someone back, whole, with a moment of safety. */
  revive(id: string, cell: Vec2): void;
  tile(cell: Vec2, value: Tile): void;
  /** Fades to black, runs `change` unseen, and fades back in. */
  cut(change: () => void | Promise<unknown>): Promise<boolean>;
}

/** The match's four facings as yaw, for the overhead view: 0 looks south. */
export const yawTo = (from: Vec2, to: Vec2) => Math.atan2(to.x - from.x, to.z - from.z);

const VEIL_MS = 450;
const SAFE_SECONDS = 2;

/**
 * Builds a director over an open match. `tick` is to be called once a frame (it is what `until`
 * and `walk` run on) and `close` when the scene is disposed.
 */
export function createDirector(stage: Stage, match: StoryMatch, lock: (on: boolean) => void) {
  let closed = false;
  const watchers = new Set<(state: Readonly<GameSnapshot>, dt: number) => boolean>();
  const player = (id: string) => match.state.players.find((p) => p.id === id)!;
  /** Adds a per-frame step that runs until it returns true. */
  const each = (step: (state: Readonly<GameSnapshot>, dt: number) => boolean) =>
    new Promise<boolean>((resolve) => {
      if (closed) return resolve(false);
      const watcher = (state: Readonly<GameSnapshot>, dt: number) => {
        if (closed) return (resolve(false), true);
        if (!step(state, dt)) return false;
        resolve(true);
        return true;
      };
      watchers.add(watcher);
    });
  const edit = (id: string, change: (p: Player) => void) =>
    match.mutate((state) => {
      const p = state.players.find((candidate) => candidate.id === id);
      if (p) change(p);
    });

  const director: Director = {
    stage,
    match,
    get state() {
      return match.state;
    },
    get hero() {
      return match.state.players[0];
    },
    actor: player,
    until: (test) => each((state) => test(state)),
    seconds(amount) {
      let left = amount;
      return each((_, dt) => (left -= dt) <= 0);
    },
    talk: (lines, options) => stage.talk(lines, options),
    lock,
    put: (id, cell, yaw) =>
      edit(id, (p) => {
        p.x = cell.x;
        p.z = cell.z;
        if (yaw !== undefined) p.yaw = yaw;
      }),
    walk(id, to, speed = 3) {
      edit(id, (p) => (p.yaw = yawTo(p, to)));
      return each((_, dt) => {
        let arrived = false;
        edit(id, (p) => {
          const gap = Math.hypot(to.x - p.x, to.z - p.z),
            step = speed * dt;
          arrived = gap <= step;
          p.x = arrived ? to.x : p.x + ((to.x - p.x) / gap) * step;
          p.z = arrived ? to.z : p.z + ((to.z - p.z) / gap) * step;
        });
        return arrived;
      });
    },
    face: (id, target) => edit(id, (p) => (p.yaw = yawTo(p, target))),
    revive: (id, cell) =>
      match.mutate((state) => {
        const p = state.players.find((candidate) => candidate.id === id);
        if (!p) return;
        p.x = cell.x;
        p.z = cell.z;
        p.alive = true;
        p.hp = p.maxHp;
        p.invulnerableUntil = state.time + SAFE_SECONDS;
        delete p.kickPush;
      }),
    tile: (cell, value) => match.mutate((state) => (state.tiles[cell.z][cell.x] = value)),
    async cut(change) {
      stage.root.classList.add("veiled");
      if (!(await stage.wait(VEIL_MS))) return false;
      await change();
      if (closed) return false;
      stage.root.classList.remove("veiled");
      return stage.wait(VEIL_MS);
    },
  };
  return {
    director,
    tick(state: Readonly<GameSnapshot>, dt: number) {
      for (const watcher of [...watchers]) if (watcher(state, dt)) watchers.delete(watcher);
    },
    close() {
      closed = true;
      for (const watcher of [...watchers]) watcher(match.state, 0);
      watchers.clear();
    },
  };
}
