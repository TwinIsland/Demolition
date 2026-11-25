/** @satisfies {import("../../../core/module-api").SkillConfig} */
const config = {
  translations: { en: {
    name: "Tactical View",
    description: "Toggle the overhead view. Use movement keys or arrows and press Space to plant a charge on your tile. Activate again to return to first person.",
  } },
  id: "shift",
  name: "维度切换",
  description: "切换至俯视视角。用移动键或方向键四向移动，空格在脚下放置炸药。再次发动即可返回第一人称。",
  icon: "map",
  key: "R",
  price: 25,
  cooldown: 0,
  duration: 0,
  order: 3,
  code: "KeyR",
};

export default config;
