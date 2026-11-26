/** @satisfies {import("../../../core/module-api").SkillConfig} */
const config = {
  translations: {
    en: {
      name: "Med Injector",
      description: "Recover 30 HP over 3 seconds. Taking damage stops the treatment.",
    },
  },
  id: "medic",
  name: "急救针",
  description: "3 秒内恢复 30 点血量，受到伤害会中断治疗",
  icon: "heart",
  sound: new URL("./activate.ogg", import.meta.url).href,
  key: "F",
  price: 30,
  cooldown: 24,
  duration: 3,
  order: 4,
  code: "KeyF",
  stats: { heal: 30 },
};

export default config;
