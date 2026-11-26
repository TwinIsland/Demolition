/** @satisfies {import("../../../core/module-api").SkillConfig} */
const config = {
  translations: {
    en: {
      name: "Blind Fuse",
      description:
        "For 7 seconds your charges hide their blast path from everyone else. You see it as a violet dashed trail.",
    },
  },
  id: "veil",
  name: "暗线引信",
  description: "7 秒内你的炸药对其他人隐藏爆炸轨迹，自己看到的是紫色虚线轨迹",
  icon: "veil",
  sound: new URL("./activate.ogg", import.meta.url).href,
  endSound: new URL("./deactivate.ogg", import.meta.url).href,
  key: "Z",
  price: 30,
  cooldown: 22,
  duration: 7,
  order: 8,
  code: "KeyZ",
};

export default config;
