/** @satisfies {import("../../../core/module-api").PerkConfig} */
const config = {
  translations: {
    en: {
      name: "Missile Strike",
      description:
        "Activate once to open the targeting tablet and pick a tile. A missile lands there 2.5 seconds later: a wide blast that ignores walls and hits hard. Only you see the landing zone at first; everyone else gets 1.5 seconds of warning.",
      tag: "Active perk",
    },
  },
  id: "missile-strike",
  name: "战术导弹",
  icon: "missile",
  art: new URL("./icon.webp", import.meta.url).href,
  tier: "diamond",
  tag: "主动强化",
  color: "#84deff",
  weight: 1,
  targeted: true,
  strikeModel: new URL("./missile.glb", import.meta.url).href,
  stats: { delay: 2.5, radius: 2.6, power: 140 },
  description:
    "主动发动一次。打开战术面板选择落点，2.5 秒后导弹落下，造成无视墙体的大范围高伤害。落点起初只有你能看到，其他人在落地前 1.5 秒才会看到范围提示。",
};

export default config;
