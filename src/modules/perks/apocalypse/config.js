/** @satisfies {import("../../../core/module-api").PerkConfig} */
const config = {
  translations: {
    en: {
      name: "Cataclysm",
      description:
        "Activate once to start a three-second arena-wide countdown. Surviving cover changes position and keeps its remaining durability, and fire sweeps the whole floor: every other operator loses 20 HP. You are spared.",
      tag: "Active perk",
    },
  },
  id: "apocalypse",
  name: "灭世",
  icon: "apocalypse",
  art: new URL("./icon.webp", import.meta.url).href,
  tier: "diamond",
  tag: "主动强化",
  color: "#84deff",
  weight: 1,
  requiresTerrainReset: true,
  stats: { delay: 3, scorch: 20 },
  description:
    "主动发动一次。全场倒计时 3 秒后，剩余可破坏掩体重新排列并保留当前耐久，同时烈焰铺满地面，其他选手各失去 20 点生命，你不受影响。",
};

export default config;
