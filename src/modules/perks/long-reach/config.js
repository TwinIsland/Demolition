/** @satisfies {import("../../../core/module-api").PerkConfig} */
const config = {
  translations: { en: {
    name: "Extended Reach",
    description: "Increase charge placement reach by one tile. Stacks.",
    tag: "Deployment",
  } },
  id: "long-reach",
  name: "延伸部署",
  description: "炸药可选落点增加 1 格，可叠加。",
  icon: "target",
  color: "#efc573",
  tag: "部署",
  tier: "gold",
  order: 9,
  weight: 1,
  stats: { reach: 1 },
};

export default config;
