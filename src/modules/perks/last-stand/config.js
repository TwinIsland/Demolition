/** @satisfies {import("../../../core/module-api").PerkConfig} */
const config = {
  translations: {
    en: {
      name: "Last Stand",
      description: "Below 35% HP you move 12% faster and your charges hit 25% harder. Does not stack.",
      tag: "Comeback",
    },
  },
  id: "last-stand",
  name: "背水一战",
  description: "血量低于 35% 时移速 +12%，部署的炸药威力 +25%。不可叠加。",
  icon: "heart",
  color: "#f07a6b",
  tag: "逆转",
  tier: "gold",
  order: 22,
  weight: 1,
  stats: { threshold: 0.35, speed: 1.12, power: 1.25 },
};

export default config;
