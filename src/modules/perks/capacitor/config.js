/** @satisfies {import("../../../core/module-api").PerkConfig} */
const config = {
  translations: {
    en: {
      name: "Rapid Circuit",
      description:
        "Reduce active skill cooldowns by 20%. Each stack applies to the remaining cooldown, up to 2 stacks.",
      tag: "Cooldown",
    },
  },
  id: "capacitor",
  name: "极速回路",
  description: "主动技能冷却缩短 20%，多层乘算，最多 2 层。",
  icon: "surge",
  color: "#86dcff",
  tag: "冷却",
  tier: "diamond",
  order: 12,
  weight: 1,
  stats: { factor: 0.8, maxStacks: 2 },
  requiresActiveSkill: true,
};

export default config;
