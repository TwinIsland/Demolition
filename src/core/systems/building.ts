import { COMBAT } from "../combat";
import { modifiedStat, RULES } from "../content";
import { BUILD, COINS } from "../economy";
import { zoneBurning, zoneClearing } from "../zone";
import type { GameSnapshot, Player, Vec2 } from "../types";
import type { SimContext } from "./context";
import { emit } from "./events";

/** Half-extent within which a body overlaps a cell. */
const FOOTPRINT = 0.5 + RULES.playerRadius;

/** The cell one step along the player's facing, snapped to the grid. */
export function cellAhead(p: Pick<Player, "x" | "z" | "yaw">): Vec2 {
  const fx = -Math.sin(p.yaw),
    fz = -Math.cos(p.yaw);
  const x = Math.round(p.x),
    z = Math.round(p.z);
  return Math.abs(fx) >= Math.abs(fz) ? { x: x + Math.sign(fx), z } : { x, z: z + Math.sign(fz) };
}

export const builtCrateAt = (s: Readonly<GameSnapshot>, x: number, z: number) =>
  s.builtCrates?.find((crate) => crate.x === x && crate.z === z);

export function removeBuiltCrate(s: GameSnapshot, x: number, z: number) {
  if (s.builtCrates) s.builtCrates = s.builtCrates.filter((crate) => crate.x !== x || crate.z !== z);
}

/** Whether the player could build on `cell` right now. Shared with the HUD and the bots. */
export function canBuild(s: Readonly<GameSnapshot>, p: Player, cell: Vec2 = cellAhead(p)) {
  const { x, z } = cell;
  const overlaps = (body: Vec2) => Math.abs(body.x - x) < FOOTPRINT && Math.abs(body.z - z) < FOOTPRINT;
  return (
    s.phase === "playing" &&
    p.alive &&
    p.credits >= BUILD.cost &&
    s.tiles[z]?.[x] === 0 &&
    !(s.zone && (zoneBurning(s.size, cell, s.zone) || zoneClearing(s.size, cell, s.zone))) &&
    !s.bombs.some((b) => b.x === x && b.z === z) &&
    !s.items.some((i) => i.x === x && i.z === z) &&
    !s.blasts.some((b) => b.x === x && b.z === z) &&
    !s.thrown.some((t) => t.x === x && t.z === z) &&
    !s.players.some((other) => other.alive && overlaps(other)) &&
    !s.zombies.some(overlaps)
  );
}

/** Pays for a crate and stands it on the cell ahead at once. */
export function build(ctx: SimContext, p: Player) {
  const s = ctx.state,
    site = cellAhead(p);
  if (!canBuild(s, p, site)) return false;
  p.credits -= BUILD.cost;
  s.tiles[site.z][site.x] = 2;
  const cell = site.z * s.size + site.x;
  delete s.coverDamage?.[s.coverOrigins?.[cell] ?? cell];
  delete s.coverOrigins?.[cell];
  (s.builtCrates ??= []).push({ id: ctx.nextId(), x: site.x, z: site.z, ownerId: p.id, builtAt: s.time });
  ctx.undead.terrainChanged(s.time);
  emit(ctx, p, "搭建木箱", { type: "build" }, site);
  return true;
}

/**
 * Opens a player-built crate. It yields no score; whoever destroys someone else's crate gets a
 * token refund, far below its price, so building can never pay for itself. The caller rolls loot.
 */
export function destroyBuiltCrate(ctx: SimContext, destroyer: Player, x: number, z: number) {
  const s = ctx.state,
    crate = builtCrateAt(s, x, z);
  if (!crate) return false;
  s.tiles[z][x] = 0;
  removeBuiltCrate(s, x, z);
  if (destroyer.alive && destroyer.id !== crate.ownerId) gainCredits(destroyer, COINS.builtCrateDestroyed);
  return true;
}

/** Melee damage to a built crate. Returns true once it has taken enough to break. */
export function damageBuiltCrate(s: GameSnapshot, x: number, z: number, amount: number) {
  const crate = builtCrateAt(s, x, z);
  if (!crate) return false;
  crate.damage = (crate.damage ?? 0) + amount;
  return crate.damage >= COMBAT.coverDurability;
}

export function gainCredits(p: Player, amount: number) {
  if (p.alive) p.credits += Math.round(modifiedStat(p, "coinGain", amount));
}
