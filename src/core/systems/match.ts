import { modifiedStat } from "../content";
import type { EffectContext } from "../module-api";
import { planWalls, rearrangeCover } from "../rearrange-cover";
import type { GameSnapshot, Player, PlayerInput, Vec2 } from "../types";
import { COMBAT } from "../combat";
import { build } from "./building";
import { hurt } from "./combat";
import { seizeLinkedBombs } from "./bombs";
import { callStrike } from "./strikes";
import type { SimContext } from "./context";

/** Seconds the finished terrain reset stays in the snapshot so clients can play it out. */
const TERRAIN_RESET_LINGER = 1.25;
/** Seconds before a scheduled reset at which the cells of moving walls are published. */
const WALL_WARNING = 1;
/** Seconds between a map's own rearrangement being announced and carried out, unless the map says. */
const SHIFT_WARNING = 4;

export function tickCountdown(s: GameSnapshot, dt: number) {
  s.countdown = Math.max(0, s.countdown - dt);
  if (!s.countdown) s.phase = "playing";
}

/** Ends an expired arena view, or forces everyone but its caster into it once its warning has run out. */
export function updateArenaView(s: GameSnapshot, stepStart: number) {
  const arenaView = s.arenaView;
  if (arenaView && s.time >= arenaView.endsAt) delete s.arenaView;
  else if (arenaView && stepStart < arenaView.startsAt && s.time >= arenaView.startsAt) {
    flatten(s, arenaView);
  }
}

/** The Cataclysm's fire sweep: it covers the whole floor, so where a victim stands does not matter. */
function scorchOthers(ctx: SimContext, ownerId: string, damage: number) {
  for (const p of ctx.state.players)
    if (p.alive && p.id !== ownerId) hurt(ctx, p, ownerId, damage, "烈焰", COMBAT.hitImmunity);
}

function flatten(s: GameSnapshot, view: NonNullable<GameSnapshot["arenaView"]>) {
  for (const p of s.players) if (p.id !== view.ownerId) p.forcedViewUntil = view.endsAt;
}

/** Returns true when the terrain was rearranged this tick; the rest of the tick is then skipped. */
export function updateTerrainReset(ctx: SimContext, inputs: ReadonlyMap<string, PlayerInput>) {
  const s = ctx.state,
    reset = s.terrainReset;
  // A map that rearranges itself. The interval has to be a real one, or it would never stop.
  const shift =
    ctx.map.randomizeTerrain && ctx.map.terrainShift && ctx.map.terrainShift.every >= 5
      ? ctx.map.terrainShift
      : undefined;
  const practiceReset =
    !reset && s.canResetTerrain && s.players.some((p) => !p.bot && p.alive && inputs.get(p.id)?.resetTerrain);
  if (practiceReset || (reset && reset.completedAt === undefined && s.time >= reset.at)) {
    rearrangeCover(s, ctx.map, ctx.random, reset?.wallPlan);
    ctx.undead.terrainChanged(s.time);
    if (reset) {
      reset.completedAt = s.time;
      if (reset.scorch) scorchOthers(ctx, reset.ownerId, reset.scorch);
    }
    // Any rearrangement, whoever called it, restarts the map's own clock.
    if (shift) s.terrainShiftAt = s.time + shift.every;
    return true;
  }
  if (shift && !reset && s.time >= (s.terrainShiftAt ?? shift.every)) {
    const warning = shift.warning ?? SHIFT_WARNING;
    s.terrainReset = { id: ctx.nextId(), ownerId: "", shift: true, at: s.time + warning };
    s.terrainShiftAt = s.time + warning + shift.every;
    return false;
  }
  if (reset && reset.completedAt === undefined && !reset.wallPlan && s.time >= reset.at - WALL_WARNING)
    reset.wallPlan = planWalls(s, ctx.map, ctx.random);
  if (reset?.completedAt !== undefined && s.time >= reset.completedAt + TERRAIN_RESET_LINGER)
    delete s.terrainReset;
  return false;
}

/** The capabilities a content module gets while one of its effects runs for this player. */
export function effectContext(ctx: SimContext, p: Player, target?: Vec2): EffectContext {
  const s = ctx.state;
  return {
    target,
    callStrike: (cell, options) => callStrike(ctx, p, cell, options),
    seizeLinkedBombs: () => seizeLinkedBombs(ctx, p),
    stat: (key, base) => modifiedStat(p, key, base, s.time),
    build: () => build(ctx, p),
    forceArenaView: (duration, warningSeconds = 0) => {
      if (
        !p.alive ||
        s.phase !== "playing" ||
        s.arenaView ||
        !Number.isFinite(duration) ||
        duration <= 0 ||
        !Number.isFinite(warningSeconds) ||
        warningSeconds < 0 ||
        s.players.some((p) => p.alive && (p.forcedViewUntil ?? 0) > s.time)
      )
        return false;
      const startsAt = s.time + warningSeconds;
      s.arenaView = { startsAt, endsAt: startsAt + duration, ownerId: p.id };
      if (!warningSeconds) flatten(s, s.arenaView);
      return true;
    },
    requestTerrainReset: (delay, scorch) => {
      if (
        !ctx.map.randomizeTerrain ||
        s.terrainReset ||
        s.phase !== "playing" ||
        !p.alive ||
        !Number.isFinite(delay) ||
        delay <= 0
      )
        return false;
      s.terrainReset = {
        id: ctx.nextId(),
        ownerId: p.id,
        at: s.time + delay,
        scorch: scorch && scorch > 0 ? scorch : undefined,
      };
      return true;
    },
  };
}

/**
 * Ends the match when at most one player is left. There is no timer: the closing zone forces
 * the ending. Practice never ends by itself. Nobody left standing is a draw.
 */
export function finishIfDecided(s: GameSnapshot) {
  const living = s.players.filter((p) => p.alive);
  if (s.mode === "practice" || living.length > 1) return;
  s.phase = "finished";
  delete s.terrainReset;
  delete s.arenaView;
  s.strikes = [];
  s.winnerId = living[0]?.id ?? null;
}
