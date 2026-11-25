/** @satisfies {import("../../../core/module-api").PerkConfig} */
const config = {
  translations: {
    en: {
      name: "Siphon Charge",
      description: "Recover HP equal to 15% of the damage you deal to opponents per stack, up to 2 stacks.",
      tag: "Recovery",
    },
  },
  id: "siphon",
  name: "虹吸装药",
  description: "命中敌人时，每层恢复实际伤害的 15%，最多 2 层。",
  icon: "heart",
  color: "#ffaece",
  tag: "续航",
  tier: "diamond",
  order: 11,
  weight: 1,
  stats: { fraction: 0.15, maxStacks: 2 },
};

export default config;
