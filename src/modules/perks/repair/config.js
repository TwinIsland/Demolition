/** @satisfies {import("../../../core/module-api").PerkConfig} */
const config = {
  translations: { en: {
    name: "Field Recovery",
    description: "Recover 40 HP and activate or refresh your tactical shield.",
    tag: "Survival",
  } },
  id: "repair",
  name: "战地恢复",
  description: "恢复 40 点血量，并启动或刷新战术护盾。",
  icon: "heart",
  color: "#ffadd8",
  tag: "生存强化",
  tier: "gold",
  order: 6,
  weight: 1,
  stats: { heal: 40, duration: 4 },
};

export default config;
