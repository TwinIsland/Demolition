/** @satisfies {import("../../../core/module-api").PerkConfig} */
const config = {
  translations: {
    en: {
      name: "Ammo Pouch",
      description: "Carry one additional active charge.",
      tag: "Firepower",
    },
  },
  id: "bubble-pocket",
  name: "弹药携行",
  description: "同时放置炸药的上限增加 1 个。",
  icon: "bomb",
  art: new URL("./icon.webp", import.meta.url).href,
  color: "#afc9ff",
  tag: "火力强化",
  tier: "silver",
  order: 5,
  weight: 1,
  stats: { amount: 1, cap: 7 },
};

export default config;
