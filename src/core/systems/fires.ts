import { COMBAT } from "../combat";
import type { GameSnapshot, ItemId, Player, Vec2 } from "../types";
import { hurt } from "./combat";
import type { SimContext } from "./context";
import { emit } from "./events";

/** Ground fire burns whoever stands in it once per tick, far more often than a blast re-hits. */
const FIRE = { tick: 0.5 } as const;

export interface FireOptions {
  /** Cells from the centre, measured in a straight line. */
  radius: number;
  duration: number;
  /** Health lost per tick spent in the fire. */
  damage: number;
}

/**
 * Open cells a fire lit at `center` covers: within `radius`, and reachable from the centre
 * without crossing a wall or cover, so flames never appear on the far side of an obstacle.
 */
export function fireCells(s: Pick<GameSnapshot, "tiles">, center: Vec2, radius: number): Vec2[] {
  const cells = [{ x: center.x, z: center.z }],
    seen = new Set([`${center.x},${center.z}`]);
  for (const cell of cells)
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const x = cell.x + dx,
        z = cell.z + dz,
        key = `${x},${z}`;
      if (seen.has(key) || s.tiles[z]?.[x] !== 0 || Math.hypot(x - center.x, z - center.z) > radius) continue;
      seen.add(key);
      cells.push({ x, z });
    }
  return cells;
}

/** Lights a pool of fire. A cell that is already burning keeps whichever fire lasts longer. */
export function spreadFire(
  ctx: SimContext,
  source: Vec2 & { ownerId: string; kind?: ItemId },
  { radius, duration, damage }: FireOptions,
) {
  const s = ctx.state,
    expiresAt = s.time + duration;
  for (const cell of fireCells(s, source, radius)) {
    const old = s.fires.find((f) => f.x === cell.x && f.z === cell.z);
    if (old && old.expiresAt >= expiresAt) continue;
    s.fires = s.fires.filter((f) => f !== old);
    s.fires.push({
      ...cell,
      id: ctx.nextId(),
      ownerId: source.ownerId,
      kind: source.kind,
      damage,
      duration,
      expiresAt,
    });
  }
  const owner = s.players.find((p) => p.id === source.ownerId);
  if (owner) emit(ctx, owner, "地面起火", { type: "ignite", item: source.kind }, source);
}

export function expireFires(s: GameSnapshot) {
  if (s.fires.length) s.fires = s.fires.filter((f) => f.expiresAt > s.time);
}

/** Burns a player standing in ground fire. Fire spares nobody, its owner included. */
export function resolveFireDamage(ctx: SimContext, p: Player) {
  const s = ctx.state;
  if (p.invulnerableUntil > s.time) return;
  const fire = s.fires.find(
    (f) => Math.abs(f.x - p.x) < COMBAT.touchRadius && Math.abs(f.z - p.z) < COMBAT.touchRadius,
  );
  if (fire) hurt(ctx, p, fire.ownerId, fire.damage, "火焰", FIRE.tick, fire.kind);
}
