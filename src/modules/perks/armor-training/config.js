/** @satisfies {import("../../../core/module-api").PerkConfig} */
const config = {
  translations: {
    en: {
      name: "Conditioning",
      description: "Gain 25 max HP and recover 25 HP.",
      tag: "Health",
    },
  },
  id: "armor-training",
  name: "强化体能",
  description: "最大血量增加 25，并恢复 25 点血量。",
  icon: "heart",
  color: "#a7db8b",
  tag: "血量强化",
  tier: "silver",
  order: 2,
  weight: 1,
  stats: { health: 25 },
};

export default config;
