/** @satisfies {import("../../../core/module-api").SkillConfig} */
const config = {
  translations: {
    en: {
      name: "Tactical View",
      description: "Toggle between first-person and overhead views.",
    },
  },
  id: "shift",
  name: "维度切换",
  description: "在第一人称与俯视视角之间切换",
  icon: "map",
  key: "R",
  price: 25,
  cooldown: 0,
  duration: 0,
  order: 3,
  code: "KeyR",
};

export default config;
