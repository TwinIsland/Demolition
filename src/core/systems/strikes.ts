import type { StrikeOptions } from "../module-api";
import type { GameSnapshot, Player, Strike, Vec2 } from "../types";
import { ignite } from "./bombs";
import type { SimContext } from "./context";
import { emit } from "./events";

/** Seconds the fire of a missile impact stays on the ground. */
export const STRIKE_FIRE = 0.9;

/** Seconds before impact at which everyone but the caller gets to see where a missile lands. */
const STRIKE_TELEGRAPH = 1.5;

/** Seconds of warning `viewerId` gets for a strike: the caller sees it from launch, everyone else late. */
export const strikeWarning = (strike: Strike, viewerId: string | undefined) => {
  const total = strike.landsAt - strike.launchedAt;
  return viewerId === undefined || viewerId === strike.ownerId ? total : Math.min(total, STRIKE_TELEGRAPH);
};

/** Whether `viewerId` can see the landing zone of a strike yet. */
export const strikeRevealed = (strike: Strike, time: number, viewerId: string | undefined) =>
  strike.landsAt - time <= strikeWarning(strike, viewerId);

/** Open and cover cells within `radius` of the impact. Permanent walls stay, but shelter nobody. */
export function strikeCells(s: Pick<GameSnapshot, "tiles" | "size">, target: Vec2, radius: number): Vec2[] {
  const cells: Vec2[] = [];
  const reach = Math.ceil(radius);
  for (let z = target.z - reach; z <= target.z + reach; z++)
    for (let x = target.x - reach; x <= target.x + reach; x++) {
      const tile = s.tiles[z]?.[x];
      if (tile === undefined || tile === 1) continue;
      if (Math.hypot(x - target.x, z - target.z) <= radius + 0.01) cells.push({ x, z });
    }
  return cells;
}

/** A missile may be called onto any cell inside the outer wall. */
export const strikeTargetValid = (s: Pick<GameSnapshot, "size">, target: Vec2 | undefined): target is Vec2 =>
  !!target &&
  Number.isInteger(target.x) &&
  Number.isInteger(target.z) &&
  target.x >= 1 &&
  target.z >= 1 &&
  target.x <= s.size - 2 &&
  target.z <= s.size - 2;

export function callStrike(ctx: SimContext, p: Player, target: Vec2, options: StrikeOptions) {
  const s = ctx.state;
  const { delay, radius, power } = options;
  if (
    !p.alive ||
    s.phase !== "playing" ||
    !strikeTargetValid(s, target) ||
    ![delay, radius, power].every((n) => Number.isFinite(n) && n > 0)
  )
    return false;
  (s.strikes ??= []).push({
    id: ctx.nextId(),
    ownerId: p.id,
    x: target.x,
    z: target.z,
    launchedAt: s.time,
    landsAt: s.time + delay,
    radius,
    power,
  });
  emit(ctx, p, "导弹来袭", { type: "strike" }, target);
  return true;
}

/** Lands every missile whose flight has ended. */
export function stepStrikes(ctx: SimContext) {
  const s = ctx.state;
  if (!s.strikes?.length) return;
  for (const strike of s.strikes) {
    if (strike.landsAt > s.time) continue;
    ignite(
      ctx,
      { ...strike, range: strike.radius, blastDuration: STRIKE_FIRE },
      strikeCells(s, strike, strike.radius),
      "missile",
      "strike-impact",
      "导弹命中",
    );
  }
  s.strikes = s.strikes.filter((strike) => strike.landsAt > s.time);
}
