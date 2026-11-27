import { ITEMS } from "../core/content";
import { RULES } from "../core/content";
import { slidingZombieContact } from "../core/zombies";
import { blastCells, blastContact, slideBlocked, SLIDE_STEP } from "../core/geometry";
import { fireCells } from "../core/systems/fires";
import { strikeCells, strikeRevealed, STRIKE_FIRE } from "../core/systems/strikes";
import { trailHidden } from "../core/types";
import type { Bomb, GameSnapshot, Vec2 } from "../core/types";
import { ZONE, zoneIgnitesIn } from "../core/zone";

type Span = { from: number; to: number };
/** Reach a bot assumes for a charge whose blast path is hidden from it. */
const GUESSED_RANGE = 1;
const key = (p: Vec2, size: number) => p.z * size + p.x;

/** Event-driven copy of just the grid and bombs. Times are relative to this decision. */
export class BombForecast {
  private fire = new Map<number, Span[]>();
  private solid = new Map<number, Span[]>();
  readonly footprints = new Map<number, Vec2[]>();
  horizon = 0;
  constructor(
    private state: Readonly<GameSnapshot>,
    extra?: Bomb | readonly Bomb[],
    kick?: Bomb,
    /** The bot this forecast is for. It cannot read the blast path of other players' concealed charges. */
    viewerId?: string,
  ) {
    const tiles = state.tiles.map((row) => row.slice());
    const bombs = [...state.bombs, ...(Array.isArray(extra) ? extra : extra ? [extra] : [])].map(
      (original) => {
        const b = kick && original.id === kick.id ? kick : original;
        // The charge itself is in plain sight; only its reach is a guess.
        const unread = viewerId !== undefined && trailHidden(b, viewerId);
        return {
          ...b,
          ...(unread ? { range: Math.min(b.range, GUESSED_RANGE), pierce: undefined } : undefined),
          slide: b.slide && { ...b.slide },
          awaitingKick: b === kick,
          entered: 0,
        };
      },
    );
    const spans = (map: Map<number, Span[]>, p: Vec2, from: number, to: number) => {
      const k = key(p, state.size),
        list = map.get(k) ?? [];
      list.push({ from, to });
      map.set(k, list);
    };
    const landings = state.thrown
      .flatMap((t) => {
        const throwable = ITEMS[t.kind]?.throwable,
          range = throwable?.blastRange;
        return range ? [{ x: t.x, z: t.z, range, at: t.landsAt + (throwable.fuse ?? 0) }] : [];
      })
      .sort((a, b) => a.at - b.at);
    // Ground fire that is already burning, and the pool a Molotov in the air is about to light.
    for (const fire of state.fires) {
      spans(this.fire, fire, 0, fire.expiresAt - state.time);
      this.horizon = Math.max(this.horizon, fire.expiresAt - state.time);
    }
    for (const t of state.thrown) {
      const fire = ITEMS[t.kind]?.throwable?.fire;
      if (!fire) continue;
      const at = Math.max(0, t.landsAt - state.time);
      for (const c of fireCells(state, t, fire.radius)) spans(this.fire, c, at, at + fire.duration);
      this.horizon = Math.max(this.horizon, at + fire.duration);
    }
    for (const b of state.blasts) {
      spans(this.fire, b, 0, b.expiresAt - state.time);
      this.horizon = Math.max(this.horizon, b.expiresAt - state.time);
    }
    const map = { size: state.size, tiles };
    const collision = { tiles, bombs, players: state.players };
    const burn = (source: Vec2 & { range: number; pierce?: number }, time: number, duration: number) => {
      const cells = blastCells(map, source);
      for (const c of cells) {
        spans(this.fire, c, time, time + duration);
        if (tiles[c.z][c.x] === 2) tiles[c.z][c.x] = 0;
      }
      this.horizon = Math.max(this.horizon, time + duration);
      return cells;
    };
    const resolveExplosions = (at: number) => {
      const time = at - state.time;
      const burning = (x: number, z: number) => this.burning(x, z, time, time);
      const contact = (b: (typeof bombs)[number]) =>
        b.awaitingKick
          ? burning(b.x, b.z)
            ? b
            : undefined
          : (blastContact(b, at, burning) ?? slidingZombieContact(state.zombies, b, at));
      let i: number;
      while ((i = bombs.findIndex((b) => (!b.slide && b.detonateAt <= at) || contact(b))) >= 0) {
        const b = bombs.splice(i, 1)[0];
        spans(this.solid, b, b.entered, time);
        this.footprints.set(
          b.id,
          burn({ ...b, ...contact(b) }, time, b.blastDuration ?? RULES.blastDuration),
        );
      }
    };
    resolveExplosions(state.time);
    while (bombs.length || landings.length) {
      let next = landings[0]?.at ?? Infinity;
      for (const b of bombs) next = Math.min(next, b.slide?.arrivedAt ?? b.detonateAt);
      next = Math.max(next, state.time);
      const time = next - state.time;
      while (landings.length && landings[0].at <= next) {
        burn(landings.shift()!, time, RULES.blastDuration);
        resolveExplosions(next);
      }
      resolveExplosions(next);
      for (const b of [...bombs]) {
        const d = b.slide;
        if (!d || d.arrivedAt > next || !bombs.includes(b)) continue;
        const x = b.x + d.x,
          z = b.z + d.z;
        if (slideBlocked(collision, x, z)) {
          b.slide = undefined;
          if (!b.awaitingKick) b.detonateAt = next;
          b.awaitingKick = false;
          resolveExplosions(next);
        } else {
          b.awaitingKick = false;
          spans(this.solid, b, b.entered, time);
          b.x = x;
          b.z = z;
          b.entered = time;
          d.arrivedAt = next + SLIDE_STEP;
          if (this.burning(x, z, time, time)) resolveExplosions(next);
        }
      }
    }
    // Incoming missiles: a bot knows where and when once the marker is shown to it.
    for (const strike of state.strikes ?? []) {
      if (!strikeRevealed(strike, state.time, viewerId)) continue;
      const at = Math.max(0, strike.landsAt - state.time);
      for (const c of strikeCells(state, strike, strike.radius)) spans(this.fire, c, at, at + STRIKE_FIRE);
      this.horizon = Math.max(this.horizon, at + STRIKE_FIRE);
    }
    // The closing zone: cells already alight, and the ring that is about to catch fire.
    const zone = state.zone;
    if (zone && !zone.final) {
      for (let z = 1; z < state.size - 1; z++)
        for (let x = 1; x < state.size - 1; x++) {
          const ignites = zoneIgnitesIn(state.size, { x, z }, state.time, state.duration);
          if (ignites > ZONE.warning + 1) continue;
          spans(this.fire, { x, z }, ignites, Infinity);
          if (ignites > 0) this.horizon = Math.max(this.horizon, ignites + 0.2);
        }
    }
  }
  burning(x: number, z: number, from: number, to: number) {
    return this.fire.get(z * this.state.size + x)?.some((s) => s.from <= to && s.to >= from) ?? false;
  }
  occupied(x: number, z: number, from: number, to: number) {
    return this.solid.get(z * this.state.size + x)?.some((s) => s.from <= to && s.to >= from) ?? false;
  }
}
