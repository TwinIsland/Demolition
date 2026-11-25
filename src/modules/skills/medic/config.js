/** @satisfies {import("../../../core/module-api").SkillConfig} */
const config = {
  translations: { en: {
    name: "Med Injector",
    description: "Immediately recover 30 HP.",
  } },
  id: "medic",
  name: "急救针",
  description: "立即恢复 30 点血量",
  icon: "heart",
  key: "F",
  price: 30,
  cooldown: 20,
  duration: 0,
  order: 4,
  code: "KeyF",
  stats: { heal: 30 },
};

export default config;
