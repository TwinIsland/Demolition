/** @satisfies {import("../../../core/module-api").PerkConfig} */
const config = {
  translations: { en: {
    name: "Siphon Charge",
    description: "Recover HP equal to 20% of the damage you deal to opponents. Stacks.",
    tag: "Recovery",
  } },
  id: "siphon",
  name: "虹吸装药",
  description: "命中敌人时，恢复实际伤害的 20%，可叠加。",
  icon: "heart",
  color: "#ffaece",
  tag: "续航",
  tier: "diamond",
  order: 11,
  weight: 1,
  stats: { fraction: 0.2 },
};

export default config;
