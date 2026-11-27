import * as v from "valibot";
import type { PerkBehavior } from "../module-api";
import { baseConfigEntries, flag, hook, nonNegative, sharedHookEntries, text } from "./common";

/** Listed from most to least common. */
export const TIER_IDS = ["silver", "gold", "diamond", "mythic"] as const;

export const PerkConfigSchema = v.object({
  ...baseConfigEntries,
  color: text,
  tier: v.picklist(TIER_IDS, `must be one of ${TIER_IDS.join(", ")}`),
  tag: text,
  weight: nonNegative,
  requiresSkill: v.optional(text),
  requiresActiveSkill: v.optional(flag),
  requiresTerrainReset: v.optional(flag),
  /** Only offered in modes where operators have a first-person view to lose. */
  requiresFreeView: v.optional(flag),
  /** The player picks a cell on the targeting panel before the perk is spent. */
  targeted: v.optional(flag),
  /** Audio asset played when the perk is triggered, instead of the shared cast cue. */
  useSound: v.optional(text),
});

const hookEntries = {
  ...sharedHookEntries,
  use: v.optional(hook),
  canUse: v.optional(hook),
  aiShouldUse: v.optional(hook),
  eligible: v.optional(hook),
  onAcquire: v.optional(hook),
  aiPriority: v.optional(hook),
  aiTarget: v.optional(hook),
} satisfies Record<keyof PerkBehavior, v.GenericSchema>;

export const PerkDefinitionSchema = v.object({
  ...PerkConfigSchema.entries,
  ...hookEntries,
  kind: v.literal("perk"),
});
