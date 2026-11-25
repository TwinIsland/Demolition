/** @satisfies {import("../../../core/module-api").PerkConfig} */
const config = {
  translations: { en: {
    name: "Signal Suppression",
    description: "Extend Radar Jam by 3 seconds and immediately refresh its cooldown.",
    tag: "Disruption",
  } },
  id: "ghost-signal",
  name: "电子压制",
  description: "雷达干扰延长 3 秒；本次技能立即就绪。",
  icon: "radar",
  color: "#90e4ef",
  tag: "干扰强化",
  tier: "gold",
  order: 8,
  weight: 1,
  stats: { seconds: 3 },
  requiresSkill: "jam",
};

export default config;
