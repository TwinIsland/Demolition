/** @satisfies {import("../../../core/module-api").PerkConfig} */
const config = {
  translations: {
    en: {
      name: "Short Fuse",
      description: "Your charges go off 15% sooner per stack, up to 2 stacks.",
      tag: "Tempo",
    },
  },
  id: "short-fuse",
  name: "短引信",
  description: "部署的炸药每层提前 15% 引爆，最多 2 层。",
  icon: "bomb",
  color: "#f2c46b",
  tag: "节奏",
  tier: "gold",
  order: 21,
  weight: 1,
  stats: { rate: 0.15, maxStacks: 2 },
};

export default config;
