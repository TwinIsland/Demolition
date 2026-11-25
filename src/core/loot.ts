import { CONSUMABLES, ITEMS } from "./content";
import type { GameSnapshot, ItemId, Player, Vec2, Zombie } from "./types";

export const CRATE_CHANCES = [0.3, 0.39, 0.51, 0.69, 1] as const;

/** Every living player contributes. Nearby players and the player who earned the drop count more. */
export function lootContext(state: GameSnapshot, position: Vec2, owner?: Player) {
  const players = state.players
    .filter((p) => p.alive)
    .map((p) => ({
      p,
      influence: (p.id === owner?.id ? 1.6 : 1) / (1 + 0.18 * Math.hypot(p.x - position.x, p.z - position.z)),
    }));
  const total = players.reduce((n, v) => n + v.influence, 0) || 1;
  const nearby: Record<string, number> = {};
  for (const item of state.items) {
    if (Math.hypot(item.x - position.x, item.z - position.z) <= 5 && CONSUMABLES.includes(item.kind))
      nearby[item.kind] = (nearby[item.kind] ?? 0) + 1;
  }
  let shortage = 0;
  for (const { p, influence } of players) {
    const stock = CONSUMABLES.reduce((n, id) => n + (p.inventory[id] ?? 0), 0);
    const missingHealth = 1 - p.hp / p.maxHp;
    shortage += (influence / total) * (0.65 - Math.min(stock, 5) * 0.25 + missingHealth * 0.55);
  }
  shortage -=
    Math.min(
      4,
      Object.values(nearby).reduce((n, v) => n + v, 0),
    ) * 0.14;
  return { players, total, nearby, shortage: Math.max(-1, Math.min(1, shortage)) };
}
type LootContext = ReturnType<typeof lootContext>;

export function dropChance(base: number, context: LootContext) {
  return base >= 1 ? 1 : Math.max(0.1, Math.min(0.97, base + 0.12 * context.shortage));
}

export function supplyDrop(context: LootContext, random: () => number): ItemId | undefined {
  const weighted = CONSUMABLES.map((id) => ITEMS[id])
    .filter((item) => item.pool === "supply")
    .map((item) => {
      const demand = context.players.reduce(
        (sum, { p, influence }) => sum + influence * (item.dropWeight?.(p, item.weight) ?? item.weight),
        0,
      );
      const weight =
        (context.players.length ? demand / context.total : item.weight) /
        (1 + 0.65 * (context.nearby[item.id] ?? 0));
      return { id: item.id, weight };
    })
    .filter((v) => Number.isFinite(v.weight) && v.weight > 0);
  let roll = random() * weighted.reduce((sum, v) => sum + v.weight, 0);
  return weighted.find((v) => (roll -= v.weight) < 0)?.id;
}

export const ZOMBIE_STATS = {
  1: {
    speed: 0.96,
    chaseMultiplier: 1.42,
    damage: 10,
    score: 40,
    sight: 6,
    equipmentChance: 0.7,
    mutationChance: 0.05,
  },
  2: {
    speed: 1.34,
    chaseMultiplier: 1.55,
    damage: 16,
    score: 60,
    sight: 7,
    equipmentChance: 0.82,
    mutationChance: 0.05,
  },
  3: {
    speed: 1.85,
    chaseMultiplier: 1.65,
    damage: 24,
    score: 100,
    sight: 8,
    equipmentChance: 0.9,
    mutationChance: 1,
  },
} as const;

export function zombieDrops(level: Zombie["level"], context: LootContext, random: () => number) {
  const loot: ItemId[] = [];
  if (random() < dropChance(ZOMBIE_STATS[level].equipmentChance, context)) {
    const id = supplyDrop(context, random);
    if (id) loot.push(id);
  }
  return loot;
}
