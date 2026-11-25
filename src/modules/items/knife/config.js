/** @satisfies {import("../../../core/module-api").ItemConfig} */
const config = {
  translations: {
    en: {
      name: "Knife",
      description: "Always available. Two strikes take down a zombie or break a piece of destructible cover.",
    },
  },
  id: "knife",
  name: "小刀",
  description: "常驻近战装备。两刀击倒僵尸，也能两刀拆除面前的可破坏掩体。",
  order: -1,
  icon: "knife",
  color: "#adc9cc",
  pool: "supply",
  weight: 0,
  model: new URL("./knife.glb", import.meta.url).href,
  permanent: true,
  melee: {
    reach: 0.94,
    damage: 24,
    cooldown: 0.36,
    inputBuffer: 0.1,
    hitSound: new URL("./impact.ogg", import.meta.url).href,
    coverDamage: 1,
    coverSounds: {
      wood: new URL("./cover-wood.ogg", import.meta.url).href,
      metal: new URL("./cover-metal.ogg", import.meta.url).href,
      soft: new URL("./cover-soft.ogg", import.meta.url).href,
    },
  },
  sound: new URL("./swing.ogg", import.meta.url).href,
};
export default config;
