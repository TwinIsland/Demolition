import * as v from "valibot";
import type { ItemBehavior } from "../module-api";
import type { CoverSurface } from "../pack-api";
import { baseConfigEntries, finite, flag, hook, nonNegative, positive, text } from "./common";

export const DROP_POOL_IDS = ["supply", "elite"] as const;

const coverSounds = v.object({
  wood: v.optional(text),
  metal: v.optional(text),
  soft: v.optional(text),
} satisfies Record<CoverSurface, unknown>);

const melee = v.object({
  reach: nonNegative,
  damage: nonNegative,
  cooldown: nonNegative,
  inputBuffer: v.optional(nonNegative),
  hitSound: v.optional(text),
  coverDamage: v.optional(nonNegative),
  coverSounds: v.optional(coverSounds),
});

const throwable = v.object({
  reach: positive,
  flight: positive,
  blastRange: v.optional(nonNegative),
  /** Seconds a landed explosive lies live before it goes off. */
  fuse: v.optional(nonNegative),
  /** Share of the thrower's attack the explosion carries. */
  powerScale: v.optional(nonNegative),
  trajectory: v.optional(v.literal("lob", 'must be "lob"')),
});

export const ItemConfigSchema = v.object({
  ...baseConfigEntries,
  color: text,
  pool: v.picklist(DROP_POOL_IDS, `must be one of ${DROP_POOL_IDS.join(", ")}`),
  weight: nonNegative,
  /** Coin price in the in-match supply shop. Items without a price are not sold. */
  price: v.optional(positive),
  model: v.optional(text),
  permanent: v.optional(flag),
  /** Optional default physical key for selecting this equipment. */
  quickEquipCode: v.optional(text),
  pickupScore: v.optional(finite),
  shieldSounds: v.optional(v.object({ broken: text, expired: text })),
  melee: v.optional(melee),
  throwable: v.optional(throwable),
});

const hookEntries = {
  onUse: v.optional(hook),
  onPickup: v.optional(hook),
  dropWeight: v.optional(hook),
  onLand: v.optional(hook),
  aiPickupValue: v.optional(hook),
} satisfies Record<keyof ItemBehavior, v.GenericSchema>;

export const ItemDefinitionSchema = v.pipe(
  v.object({ ...ItemConfigSchema.entries, ...hookEntries, kind: v.literal("item") }),
  // A thrown item resolves on landing, so it cannot also be used on the holder.
  v.forward(
    v.check((item) => !item.throwable || Boolean(item.onLand), "is required for throwable items"),
    ["onLand"],
  ),
  v.forward(
    v.check((item) => !item.throwable || !item.onUse, "must be omitted for throwable items"),
    ["onUse"],
  ),
);
