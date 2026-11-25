/** @satisfies {import("../../../core/module-api").PerkConfig} */
const config = {
  id: "dimension-collapse",
  name: "维度坍缩",
  icon: "collapse",
  tier: "mythic",
  tag: "主动强化",
  color: "#dc9cff",
  weight: 1,
  stats: { warningSeconds: 3, duration: 10 },
  description: "全场倒计时 3 秒后，所有选手进入二维视角。持续 10 秒，随后恢复各自的视角。",
  translations: {
    en: {
      name: "Dimensional Collapse",
      tag: "Active perk",
      description:
        "After a 3-second arena countdown, lock every operator in overhead view for 10 seconds. Each operator then returns to their previous view.",
    },
  },
};

export default config;
