import type { Translations } from "../i18n";

export interface KnifeStyle {
  translations?: Translations;
  id: string;
  name: string;
  /** GLB that replaces the knife's own model: upright, handle down, thin along Z. */
  model?: string;
  /** Emissive tint for the lit parts of the texture. */
  glow?: string;
}

const model = (id: string) => `./assets/knives/${id}.glb`;

/** Cosmetic knives, all equal. `standard` is the knife item's own model. */
const styles: KnifeStyle[] = [
  { id: "standard", name: "制式小刀", translations: { en: { name: "Service Knife" } } },
  {
    id: "tactical",
    name: "战术格斗刀",
    translations: { en: { name: "Tactical Combat" } },
    model: model("tactical"),
  },
  {
    id: "damascus",
    name: "大马士革猎刀",
    translations: { en: { name: "Damascus Hunting" } },
    model: model("damascus"),
  },
  {
    id: "butterfly",
    name: "蝴蝶刀",
    translations: { en: { name: "Butterfly" } },
    model: model("butterfly"),
  },
  {
    id: "karambit",
    name: "爪刀",
    translations: { en: { name: "Karambit" } },
    model: model("karambit"),
  },
  {
    id: "scifi",
    name: "科幻匕首",
    translations: { en: { name: "Sci-Fi Dagger" } },
    model: model("scifi"),
    glow: "#39e6ff",
  },
];

export const KNIFE_STYLES: Readonly<Record<string, KnifeStyle>> = Object.freeze(
  Object.fromEntries(styles.map((style) => [style.id, style])),
);
export const DEFAULT_KNIFE = styles[0];
