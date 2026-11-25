/** @satisfies {import("../../../core/module-api").PerkConfig} */
const config = {
  translations: { en: {
    name: "Fleet Footed",
    description: "Increase movement speed by 15% for the rest of the match.",
    tag: "Mobility",
  } },
  id: "light-feet",
  name: "快速移动",
  description: "移动速度永久提高 15%，穿梭战场更从容。",
  icon: "speed",
  color: "#a6f3d3",
  tag: "机动强化",
  tier: "silver",
  order: 4,
  weight: 1,
  stats: { amount: 1.15, cap: 4.5 },
};

export default config;
