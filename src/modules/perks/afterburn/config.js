/** @satisfies {import("../../../core/module-api").PerkConfig} */
const config = {
  translations: {
    en: {
      name: "Afterburn",
      description: "Each stack extends charge fire by 0.2 seconds, up to 3 stacks.",
      tag: "Area denial",
    },
  },
  id: "afterburn",
  name: "余燃",
  description: "部署的炸药每层延长 0.2 秒火场时间，最多 3 层。",
  icon: "flame",
  art: new URL("./icon.webp", import.meta.url).href,
  color: "#e8a656",
  tag: "区域封锁",
  tier: "gold",
  weight: 1,
  order: 14,
  stats: { seconds: 0.2, maxStacks: 3 },
};

export default config;
