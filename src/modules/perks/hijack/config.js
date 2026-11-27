/** @satisfies {import("../../../core/module-api").PerkConfig} */
const config = {
  translations: {
    en: {
      name: "Hijack",
      description:
        "Activate once. Every charge and live grenade within 3 tiles of you becomes yours: it scores for you, costs you only own-charge damage, and no longer spares the operator who planted it. Hijacked charges do not use your charge slots.",
      tag: "Active perk",
    },
  },
  id: "hijack",
  name: "劫持信号",
  icon: "hijack",
  tier: "diamond",
  tag: "主动强化",
  color: "#84deff",
  weight: 1,
  useSound: new URL("./use.ogg", import.meta.url).href,
  stats: { radius: 3 },
  description:
    "主动发动一次。以你为中心 3 格内的所有炸药和未爆手雷立刻归你所有：击杀和积分算你的，对你只造成自爆伤害，原主人则会被全额炸伤。夺来的炸药不占用你的炸药栏位。",
};

export default config;
