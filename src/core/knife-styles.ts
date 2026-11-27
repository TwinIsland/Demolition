import type { Translations } from "../i18n";

export const KNIFE_RARITIES = {
  standard: { name: "默认", color: "#aeb8b4" },
  common: { name: "常见", color: "#c3ccd0" },
  rare: { name: "稀有", color: "#5aa9ff" },
  epic: { name: "史诗", color: "#b77bff" },
  legendary: { name: "传说", color: "#f6c261" },
  mythic: { name: "神话", color: "#ff6b7d" },
} as const;
export type KnifeRarity = keyof typeof KNIFE_RARITIES;

export interface KnifeStyle {
  translations?: Translations;
  id: string;
  name: string;
  rarity: KnifeRarity;
  /** GLB that replaces the knife's own model: upright, handle down, thin along Z. */
  model?: string;
  /** Emissive tint for the lit parts of the texture. */
  glow?: string;
}

const model = (id: string) => `./assets/knives/${id}.glb`;

/** Cosmetic knives, in rarity order. `standard` is the knife item's own model. */
const styles: KnifeStyle[] = [
  { id: "standard", name: "制式小刀", translations: { en: { name: "Service Knife" } }, rarity: "standard" },
  {
    id: "tactical",
    name: "战术格斗刀",
    translations: { en: { name: "Tactical Combat" } },
    rarity: "common",
    model: model("tactical"),
  },
  {
    id: "damascus",
    name: "大马士革猎刀",
    translations: { en: { name: "Damascus Hunting" } },
    rarity: "rare",
    model: model("damascus"),
  },
  {
    id: "butterfly",
    name: "蝴蝶刀",
    translations: { en: { name: "Butterfly" } },
    rarity: "epic",
    model: model("butterfly"),
  },
  {
    id: "karambit",
    name: "爪刀",
    translations: { en: { name: "Karambit" } },
    rarity: "legendary",
    model: model("karambit"),
  },
  {
    id: "scifi",
    name: "科幻匕首",
    translations: { en: { name: "Sci-Fi Dagger" } },
    rarity: "mythic",
    model: model("scifi"),
    glow: "#39e6ff",
  },
];

export const KNIFE_STYLES: Readonly<Record<string, KnifeStyle>> = Object.freeze(
  Object.fromEntries(styles.map((style) => [style.id, style])),
);
export const DEFAULT_KNIFE = styles[0];
