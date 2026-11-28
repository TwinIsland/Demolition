/** @satisfies {import("../../../core/module-api").PerkConfig} */
const config = {
  translations: {
    en: {
      name: "High Explosive",
      description: "Increase the blast range of all charges by one tile for the rest of the match.",
      tag: "Blast range",
    },
  },
  id: "long-wave",
  name: "高爆装药",
  description: "所有炸药的爆炸范围永久增加 1 格。",
  icon: "flask",
  art: new URL("./icon.webp", import.meta.url).href,
  color: "#ffb5a0",
  tag: "范围强化",
  tier: "silver",
  order: 3,
  weight: 1,
  stats: { amount: 1, cap: 5 },
};

export default config;
