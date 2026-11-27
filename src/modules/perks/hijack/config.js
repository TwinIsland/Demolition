/** @satisfies {import("../../../core/module-api").PerkConfig} */
const config = {
  translations: {
    en: {
      name: "Hijack",
      description:
        "Activate once. Every enemy charge whose blast path joins up with the path of one of your own charges becomes yours, and so does every charge chained on through them. They score for you, cost you only own-charge damage, and no longer spare whoever planted them. Hijacked charges do not use your charge slots.",
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
  description:
    "主动发动一次。凡是爆炸轨迹与你的炸药轨迹相连的敌方炸药，以及通过它们继续连上的炸药，全部立刻归你所有：击杀和积分算你的，对你只造成自爆伤害，原主人则会被全额炸伤。夺来的炸药不占用你的炸药栏位。",
};

export default config;
