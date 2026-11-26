/** @satisfies {import("../../../core/module-api").PerkConfig} */
const config = {
  translations: {
    en: {
      name: "Missile Strike",
      description:
        "Activate once to open the targeting tablet and pick a tile. Three seconds later a missile lands there: a wide blast that ignores walls and hits hard.",
      tag: "Active perk",
    },
  },
  id: "missile-strike",
  name: "战术导弹",
  icon: "missile",
  tier: "diamond",
  tag: "主动强化",
  color: "#84deff",
  weight: 1,
  targeted: true,
  stats: { delay: 3, radius: 2.6, power: 140 },
  description: "主动发动一次。打开战术面板选择落点，3 秒后导弹落下，造成无视墙体的大范围高伤害。",
};

export default config;
