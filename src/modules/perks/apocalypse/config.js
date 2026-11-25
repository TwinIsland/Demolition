/** @satisfies {import("../../../core/module-api").PerkConfig} */
const config = {
  translations: { en: {
    name: "Cataclysm",
    description: "Activate once to start a three-second arena-wide countdown. Surviving cover changes position and keeps its remaining durability.",
    tag: "Active perk",
  } },
  id:"apocalypse", name:"灭世", icon:"apocalypse", tier:"diamond", tag:"主动强化",
  color:"#84deff", weight:1, requiresTerrainReset:true, stats:{ delay:3 },
  description:"主动发动一次。全场倒计时 3 秒后，剩余可破坏掩体重新排列，并保留当前耐久。",
};

export default config;
