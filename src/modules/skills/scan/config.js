/** @satisfies {import("../../../core/module-api").SkillConfig} */
const config = {
  translations: {
    en: {
      name: "Threat Scan",
      description: "See operators and zombies through cover as night-vision silhouettes for 7 seconds.",
    },
  },
  id: "scan",
  name: "战术透视",
  description: "透过掩体显示对手与僵尸的全身夜视剪影，持续 7 秒",
  icon: "radar",
  sound: new URL("./activate.ogg", import.meta.url).href,
  key: "C",
  price: 25,
  cooldown: 25,
  duration: 7,
  order: 6,
  code: "KeyC",
};

export default config;
