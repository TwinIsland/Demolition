/** @satisfies {import("../../../core/module-api").SkillConfig} */
const config = {
  translations: {
    en: {
      name: "Remote Detonator",
      description: "Set off all of your planted charges after a 0.35 second delay.",
    },
  },
  id: "detonator",
  name: "遥控起爆",
  description: "让自己已部署的全部炸药在 0.35 秒后引爆",
  icon: "bomb",
  key: "E",
  price: 30,
  cooldown: 10,
  duration: 0,
  order: 7,
  code: "KeyE",
  stats: { delay: 0.35 },
};

export default config;
