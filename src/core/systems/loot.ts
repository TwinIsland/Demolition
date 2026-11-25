import { COMBAT } from "../combat";
import { combatMessage } from "../combat-message";
import { eachOwned, isEquipment, ITEMS, modifiedStat } from "../content";
import { fieldSupply, supplyInterval } from "../field-supplies";
import { CRATE_CHANCES, dropChance, lootContext, supplyDrop, zombieDrops } from "../loot";
import { DIRECTIONS } from "../maps";
import type { Player, Zombie } from "../types";
import { COINS } from "../economy";
import { destroyBuiltCrate, gainCredits } from "./building";
import type { SimContext } from "./context";
import { emit } from "./events";
import { gainScore } from "./progression";

type DropOutcome = "dropped" | "missed" | "occupied";

function dropItem(ctx: SimContext, x: number, z: number, chance: number, owner: Player): DropOutcome {
  const s = ctx.state;
  if (s.items.some((i) => i.x === x && i.z === z)) return "occupied";
  const context = lootContext(s, { x, z }, owner);
  if (ctx.random() >= dropChance(chance, context)) return "missed";
  const kind = supplyDrop(context, ctx.random);
  if (!kind) return "missed";
  s.items.push({ x, z, id: ctx.nextId(), kind });
  return "dropped";
}

/** Opens a cover cell: scores it for a living owner and rolls its drop. Returns the score awarded. */
export function destroyCover(ctx: SimContext, owner: Player, x: number, z: number) {
  const s = ctx.state,
    cell = z * s.size + x;
  if (destroyBuiltCrate(ctx, owner, x, z)) return 0;
  s.tiles[z][x] = 0;
  delete s.coverDamage?.[s.coverOrigins?.[cell] ?? cell];
  delete s.coverOrigins?.[cell];
  let score = 0;
  if (owner.alive) {
    eachOwned(owner, (m, n) => m.onCoverDestroyed?.(owner, n));
    score = modifiedStat(owner, "crateScore", COMBAT.crateScore, s.time);
    gainScore(ctx, owner, score);
    gainCredits(owner, COINS.coverDestroyed);
  }
  const misses = ctx.crateMisses.get(owner.id) ?? 0;
  const drop = dropItem(ctx, x, z, CRATE_CHANCES[misses], owner);
  // An occupied cell never rolled, so it neither resets nor advances the pity counter.
  if (drop !== "occupied")
    ctx.crateMisses.set(owner.id, drop === "dropped" ? 0 : Math.min(misses + 1, CRATE_CHANCES.length - 1));
  return score;
}

/** Zombie loot lands on its cell, or on the first free neighbour when that cell is taken. */
export function dropZombieLoot(ctx: SimContext, zombie: Zombie, owner: Player) {
  const s = ctx.state,
    x = Math.round(zombie.x),
    z = Math.round(zombie.z);
  for (const kind of zombieDrops(zombie.level, lootContext(s, zombie, owner), ctx.random)) {
    const candidates = [{ x, z }, ...DIRECTIONS.map((d) => ({ x: x + d.x, z: z + d.z }))];
    const cell = candidates.find(
      (c) =>
        s.tiles[c.z]?.[c.x] === 0 &&
        !s.items.some((i) => i.x === c.x && i.z === c.z) &&
        !s.bombs.some((b) => b.x === c.x && b.z === c.z),
    );
    s.items.push({ ...(cell ?? { x, z }), kind, id: ctx.nextId() });
  }
}

export function collectItems(ctx: SimContext, p: Player) {
  const s = ctx.state;
  for (const item of [...s.items])
    if (Math.hypot(item.x - p.x, item.z - p.z) < COMBAT.touchRadius) {
      const def = ITEMS[item.kind];
      // Snapshots or mods may reference an item that is no longer registered.
      if (!def) {
        s.items = s.items.filter((i) => i.id !== item.id);
        continue;
      }
      if (isEquipment(def)) p.inventory[item.kind] = (p.inventory[item.kind] ?? 0) + 1;
      def.onPickup?.(p);
      s.items = s.items.filter((i) => i.id !== item.id);
      emit(ctx, p, combatMessage("获得{0}", ITEMS[item.kind]), { type: "pickup", item: item.kind });
      gainScore(ctx, p, def.pickupScore ?? COMBAT.pickupScore);
    }
}

/** Periodic drop on an open cell away from every player. */
export function spawnFieldSupply(ctx: SimContext) {
  const s = ctx.state;
  if (s.time < ctx.nextSupplyAt) return;
  ctx.nextSupplyAt = s.time + supplyInterval(ctx.random);
  const item = fieldSupply(s, ctx.random, ctx.nextId);
  if (item) s.items.push(item);
}
