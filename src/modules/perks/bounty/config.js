/** @satisfies {import("../../../core/module-api").PerkConfig} */
const config = {
  translations: { en: {
    name: "Demolition Contract",
    description: "Earn 10 extra score for each piece of cover you destroy. Stacks.",
    tag: "Progression",
  } },
  id: "bounty",
  name: "拆除合约",
  description: "每摧毁一处掩体额外获得 10 积分，可叠加。",
  icon: "crown",
  color: "#ffcc74",
  tag: "成长",
  tier: "gold",
  order: 13,
  weight: 1,
  stats: { points: 10 },
};

export default config;
