/** @satisfies {import("../../../core/module-api").PerkConfig} */
const config = {
  translations: {
    en: {
      name: "Extended Reach",
      description: "Increase charge placement reach by one tile per stack, up to 2 stacks.",
      tag: "Deployment",
    },
  },
  id: "long-reach",
  name: "延伸部署",
  description: "炸药可选落点每层增加 1 格，最多 2 层。",
  icon: "target",
  art: new URL("./icon.webp", import.meta.url).href,
  color: "#efc573",
  tag: "部署",
  tier: "gold",
  order: 9,
  weight: 1,
  stats: { reach: 1, maxStacks: 2 },
};

export default config;
