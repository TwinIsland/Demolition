/** @satisfies {import("../../../core/module-api").SkillConfig} */
const config = {
  translations: {
    en: {
      name: "Optical Camo",
      description:
        "Turn invisible for 6 seconds. Opponents, bots and zombies lose sight of you; Threat Scan still reveals you.",
    },
  },
  id: "cloak",
  name: "光学迷彩",
  description: "隐身 6 秒，对手、AI 与僵尸都看不到你；战术透视仍能发现你",
  icon: "cloak",
  sound: new URL("./activate.ogg", import.meta.url).href,
  endSound: new URL("./deactivate.ogg", import.meta.url).href,
  endSoundRange: 7,
  key: "Q",
  price: 35,
  cooldown: 30,
  duration: 6,
  order: 9,
  code: "KeyQ",
};

export default config;
