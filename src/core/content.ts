import modules from "#game-catalog";
import type {
  ContentModule,
  Hooks,
  ItemDefinition,
  PerkDefinition,
  SkillDefinition,
  Tier,
} from "./module-api";
import { assertValid, ItemDefinitionSchema, PerkDefinitionSchema, SkillDefinitionSchema } from "./schema";
import type { PerkId, Player } from "./types";

export type { PerkDefinition } from "./module-api";

export const TIERS = {
  silver: { name: "白银", weight: 61, color: "#bdcad4", sound: "perk-silver" },
  gold: { name: "黄金", weight: 30, color: "#f6c261", sound: "perk-gold" },
  diamond: { name: "钻石", weight: 8, color: "#93e6ff", sound: "perk-diamond" },
  mythic: { name: "神话", weight: 1, color: "#dc9cff", sound: "perk-diamond" },
} satisfies Record<Tier, { name: string; weight: number; color: string; sound: string }>;
export const SLOT_LIMIT = 4;

export const RULES = {
  fuse: 2.65,
  blastDuration: 0.42,
  duration: 180,
  countdown: 3,
  startingCredits: 115,
  step: 1 / 60,
  playerRadius: 0.24,
  /** Largest sideways offset from a lane centre, in cells, that corner assist will correct. */
  cornerAssist: 0.42,
  baseSpeed: 2.3,
  jumpSpeed: 9.4,
  jumpGravity: 36,
  fallGravity: 48,
  baseRange: 2,
  baseCapacity: 2,
} as const;

// --- Registry construction -------------------------------------------------------------------

const DEFINITION_SCHEMAS = {
  skill: SkillDefinitionSchema,
  perk: PerkDefinitionSchema,
  item: ItemDefinitionSchema,
} satisfies Record<ContentModule["kind"], unknown>;

/** Prototype-free so content IDs can never collide with inherited keys. */
const createRegistry = <T>(): Record<string, T> => Object.create(null);

function register<T extends ContentModule>(registry: Record<string, T>, definition: T) {
  if (registry[definition.id]) throw new Error(`Duplicate ${definition.kind} ID: ${definition.id}`);
  registry[definition.id] = definition;
}

function buildRegistries(definitions: readonly ContentModule[]) {
  for (const definition of definitions) {
    if (!Object.hasOwn(DEFINITION_SCHEMAS, definition.kind))
      throw new Error(`Unknown module kind: ${String(definition.kind)} (${String(definition.id)})`);
    assertValid(definition.kind, DEFINITION_SCHEMAS[definition.kind], definition);
  }

  const skills = createRegistry<SkillDefinition>();
  const perks = createRegistry<PerkDefinition>();
  const items = createRegistry<ItemDefinition>();
  const boundKeys = new Set<string>();
  // Registration order is the iteration order of every registry, and part of the determinism contract.
  const ordered = [...definitions].sort(
    (a, b) => (a.order ?? 100) - (b.order ?? 100) || a.id.localeCompare(b.id, "en"),
  );
  for (const definition of ordered) {
    switch (definition.kind) {
      case "skill":
        register(skills, definition);
        if (definition.code) {
          if (boundKeys.has(definition.code)) throw new Error(`Duplicate skill key: ${definition.code}`);
          boundKeys.add(definition.code);
        }
        break;
      case "perk":
        register(perks, definition);
        break;
      case "item":
        // "bomb" is the built-in equipment slot.
        if (definition.id === "bomb") throw new Error('Invalid item "bomb": id is reserved');
        register(items, definition);
        break;
    }
  }
  return { skills, perks, items };
}

const { skills, perks, items } = buildRegistries(modules);

export const HAS_TICK_HOOKS = modules.some((m) => m.kind !== "item" && m.onTick);
export const SKILLS = Object.freeze(skills);
export const ITEMS = Object.freeze(items);
export const PERKS = Object.values(perks);
export const SHOP_SKILLS = Object.keys(skills);
export const isEquipment = (item: ItemDefinition) => Boolean(item.throwable || item.onUse || item.melee);
const equipment = Object.values(items).filter(isEquipment);
export const CONSUMABLES = equipment.filter((item) => !item.permanent).map((item) => item.id);
export const EQUIPMENT_SLOTS = ["bomb", ...equipment.map((item) => item.id)];

// --- Queries -----------------------------------------------------------------------------------

export const perkById = (id: PerkId) => perks[id];

export function eachOwned(p: Player, visit: (hooks: Hooks, stacks: number) => void) {
  for (const id of p.skills) if (skills[id]) visit(skills[id], 1);
  if (!p.perks.length) return;
  const stacks = new Map<PerkId, number>();
  for (const id of p.perks) stacks.set(id, (stacks.get(id) ?? 0) + 1);
  for (const [id, n] of stacks) if (perks[id]) visit(perks[id], n);
}

export function modifiedStat(p: Player, stat: keyof NonNullable<Hooks["modifiers"]>, base: number, time = 0) {
  let value = base;
  eachOwned(p, (hooks, n) => {
    const modify = hooks.modifiers?.[stat];
    if (modify) value = modify(value, p, n, time);
  });
  return value;
}

export function rollPerks(
  player: Player,
  random: () => number,
  previous: PerkId[] = [],
  guaranteeRare = false,
  supportsTerrainReset = false,
  freeView = true,
) {
  const pool = PERKS.filter(
    (p) =>
      p.weight > 0 &&
      (!p.requiresTerrainReset || supportsTerrainReset) &&
      (!p.requiresFreeView || freeView) &&
      (!p.requiresSkill || player.skills.includes(p.requiresSkill)) &&
      (!p.requiresActiveSkill || player.skills.some((id) => skills[id]?.activate)) &&
      (!p.eligible || p.eligible(player)),
  );
  const offers: PerkId[] = [];
  while (offers.length < 3 && pool.length) {
    let tiers = (Object.keys(TIERS) as Tier[]).filter((t) => pool.some((p) => p.tier === t));
    if (
      guaranteeRare &&
      offers.length === 2 &&
      offers.every((id) => perks[id].tier === "silver") &&
      tiers.some((t) => t !== "silver")
    )
      tiers = tiers.filter((t) => t !== "silver");
    let roll = random() * tiers.reduce((sum, t) => sum + TIERS[t].weight, 0);
    const tier = tiers.find((t) => (roll -= TIERS[t].weight) < 0) ?? tiers[0];
    const choices = pool.filter((p) => p.tier === tier);
    const weight = (p: PerkDefinition) => p.weight * (previous.includes(p.id) ? 1 : 2);
    let pick = random() * choices.reduce((sum, p) => sum + weight(p), 0);
    const chosen = choices.find((p) => (pick -= weight(p)) < 0) ?? choices[0];
    offers.push(chosen.id);
    pool.splice(pool.indexOf(chosen), 1);
  }
  return offers;
}
