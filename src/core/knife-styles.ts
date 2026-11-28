import { ITEMS } from "./content";
import type { ItemConfig } from "./module-api";

export type KnifeStyle = NonNullable<ItemConfig["styles"]>[number];

/** Cosmetic knives, all equal: the `styles` of the melee item, which also ships their models. */
const styles: readonly KnifeStyle[] = Object.values(ITEMS).find((item) => item.melee)?.styles ?? [];

export const DEFAULT_KNIFE: KnifeStyle = styles[0] ?? { id: "standard", name: "制式小刀" };
export const KNIFE_STYLES: Readonly<Record<string, KnifeStyle>> = Object.freeze(
  Object.fromEntries([DEFAULT_KNIFE, ...styles].map((style) => [style.id, style])),
);
