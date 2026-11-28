import * as v from "valibot";
import type { Language } from "../../i18n";
import type { Hooks } from "../module-api";

/** Content IDs double as folder names, snapshot keys and URL segments. */
export const ID_PATTERN = /^[a-z][a-z0-9-]*$/;

export const id = v.pipe(
  v.string("must be a string"),
  v.regex(ID_PATTERN, `must match ${ID_PATTERN}`),
  // Registries are prototype-free, but snapshots and mods index plain objects by ID.
  v.check((value) => !(value in Object.prototype), "must not shadow an Object.prototype key"),
);
export const text = v.string("must be a string");
export const label = v.pipe(text, v.nonEmpty("must not be empty"));
export const flag = v.boolean("must be a boolean");
export const finite = v.pipe(v.number("must be a number"), v.finite("must be finite"));
export const nonNegative = v.pipe(finite, v.minValue(0, "must be >= 0"));
export const positive = v.pipe(finite, v.gtValue(0, "must be > 0"));
export const hook = v.function("must be a function");

const translatedFields = v.object({
  name: v.optional(text),
  description: v.optional(text),
  tag: v.optional(text),
  subtitle: v.optional(text),
});
// Unknown locales are ignored so a mod can ship more languages than the game selects.
export const translations = v.object({
  en: v.optional(translatedFields),
  zh: v.optional(translatedFields),
} satisfies Record<Language, unknown>);

/** Declarative fields shared by every content module. */
export const baseConfigEntries = {
  translations: v.optional(translations),
  id,
  name: label,
  description: text,
  icon: label,
  /** Painted icon shipped in the module's own folder; `icon` stays the line glyph for small tinted slots. */
  art: v.optional(text),
  /** Optional audio asset for successful item use, skill activation, or perk acquisition. */
  sound: v.optional(text),
  order: v.optional(finite),
  stats: v.optional(v.pipe(v.record(v.string(), v.number("must be a number")), v.readonly())),
};
export const BaseConfigSchema = v.object(baseConfigEntries);

/** Hooks shared by skills and perks. The record type keeps this list in step with `Hooks`. */
export const sharedHookEntries = {
  onTick: v.optional(hook),
  modifiers: v.optional(v.record(v.string(), hook)),
  onCoverDestroyed: v.optional(hook),
  onDamageDealt: v.optional(hook),
  onBombContact: v.optional(hook),
} satisfies Record<keyof Hooks, v.GenericSchema>;

type Issue = v.BaseIssue<unknown>;

function describe(issue: Issue) {
  const path = v.getDotPath(issue);
  const missing = issue.kind === "schema" && issue.received === "undefined";
  const message = missing ? "is required" : issue.message;
  return path ? `${path} ${message}` : message;
}

/**
 * Throws `Invalid <kind> "<id>": <path> <problem>` for the first failing rule.
 * The input itself stays the registered object: definitions carry hooks and mod-private
 * fields that a parsed copy would drop.
 */
export function assertValid(kind: string, schema: v.GenericSchema, input: unknown) {
  if (typeof input !== "object" || input === null)
    throw new Error(`Invalid ${kind}: the default export must be a definition object`);
  const result = v.safeParse(schema, input, { abortEarly: true });
  if (result.success) return;
  const rawId = (input as { id?: unknown }).id;
  const name = typeof rawId === "string" ? JSON.stringify(rawId) : "<unknown>";
  throw new Error(`Invalid ${kind} ${name}: ${describe(result.issues[0])}`);
}
