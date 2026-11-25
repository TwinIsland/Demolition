import * as v from "valibot";
import type { SkillBehavior } from "../module-api";
import { baseConfigEntries, flag, hook, nonNegative, sharedHookEntries, text } from "./common";

export const SkillConfigSchema = v.object({
  ...baseConfigEntries,
  price: nonNegative,
  cooldown: nonNegative,
  duration: nonNegative,
  /** Key label shown in the shop and skill bar. */
  key: text,
  /** Default physical key (`KeyboardEvent.code`). */
  code: v.optional(text),
  passive: v.optional(flag),
});

const hookEntries = {
  ...sharedHookEntries,
  canActivate: v.optional(hook),
  activate: v.optional(hook),
  activeUntil: v.optional(hook),
  isActive: v.optional(hook),
  aiCastPriority: v.optional(hook),
} satisfies Record<keyof SkillBehavior, v.GenericSchema>;

export const SkillDefinitionSchema = v.pipe(
  v.object({ ...SkillConfigSchema.entries, ...hookEntries, kind: v.literal("skill") }),
  v.forward(
    v.check((skill) => Boolean(skill.passive || skill.activate), "is required unless the skill is passive"),
    ["activate"],
  ),
);
