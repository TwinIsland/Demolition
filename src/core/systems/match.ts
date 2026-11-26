import { modifiedStat } from "../content";
import type { EffectContext } from "../module-api";
import { planWalls, rearrangeCover } from "../rearrange-cover";
import type { GameSnapshot, Player, PlayerInput, Vec2 } from "../types";
import { startBuild } from "./building";
import { callStrike } from "./strikes";
import type { SimContext } from "./context";

/** Seconds the finished terrain reset stays in the snapshot so clients can play it out. */
const TERRAIN_RESET_LINGER = 1.25;
/** Seconds before a scheduled reset at which the cells of moving walls are published. */
const WALL_WARNING = 1;

export function tickCountdown(s: GameSnapshot, dt: number) {
  s.countdown = Math.max(0, s.countdown - dt);
  if (!s.countdown) s.phase = "playing";
}

/** Ends an expired arena view, or forces every player into it once its warning has run out. */
export function updateArenaView(s: GameSnapshot, stepStart: number) {
  const arenaView = s.arenaView;
  if (arenaView && s.time >= arenaView.endsAt) delete s.arenaView;
  else if (arenaView && stepStart < arenaView.startsAt && s.time >= arenaView.startsAt) {
    for (const p of s.players) p.forcedViewUntil = arenaView.endsAt;
  }
}

/** Returns true when the terrain was rearranged this tick; the rest of the tick is then skipped. */
export function updateTerrainReset(ctx: SimContext, inputs: ReadonlyMap<string, PlayerInput>) {
  const s = ctx.state,
    reset = s.terrainReset;
  const practiceReset =
    !reset && s.canResetTerrain && s.players.some((p) => !p.bot && p.alive && inputs.get(p.id)?.resetTerrain);
  if (practiceReset || (reset && reset.completedAt === undefined && s.time >= reset.at)) {
    rearrangeCover(s, ctx.map, ctx.random, reset?.wallPlan);
    ctx.undead.terrainChanged(s.time);
    if (reset) reset.completedAt = s.time;
    return true;
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
    stat: (key, base) => modifiedStat(p, key, base, s.time),
    build: () => startBuild(ctx, p),
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
      s.arenaView = { startsAt, endsAt: startsAt + duration };
      if (!warningSeconds) for (const p of s.players) p.forcedViewUntil = s.arenaView.endsAt;
      return true;
    },
    requestTerrainReset: (delay) => {
      if (
        !ctx.map.randomizeTerrain ||
        s.terrainReset ||
        s.phase !== "playing" ||
        !p.alive ||
        !Number.isFinite(delay) ||
        delay <= 0
      )
        return false;
      s.terrainReset = { id: ctx.nextId(), ownerId: p.id, at: s.time + delay };
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
