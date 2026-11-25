/** @satisfies {import("../../../core/module-api").PerkConfig} */
const config = {
  translations: { en: {
    name: "Overcharge",
    description: "Add one more tile to Blast Surge and immediately refresh its cooldown.",
    tag: "Skill upgrade",
  } },
  id: "overcharge",
  name: "过载回路",
  description: "范围爆发多强化 1 格；本次技能立即就绪。",
  icon: "surge",
  color: "#c3a6ff",
  tag: "技能强化",
  tier: "gold",
  order: 7,
  weight: 1,
  stats: { bonus: 1 },
  requiresSkill: "surge",
};

export default config;
