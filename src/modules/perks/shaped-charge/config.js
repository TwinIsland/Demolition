/** @satisfies {import("../../../core/module-api").PerkConfig} */
const config = {
  translations: { en: {
    name: "Shaped Charge",
    description: "Increase attack power by 25%. Your charge bundle and blast warning change with power.",
    tag: "Damage",
  } },
  id: "shaped-charge",
  name: "强化装药",
  description: "攻击力提高 25%。炸药束与地面预警纹理随威力升级。",
  icon: "target",
  color: "#f6a36b",
  tag: "伤害强化",
  tier: "gold",
  order: 1,
  weight: 1,
  stats: { factor: 1.25, cap: 250 },
};

export default config;
