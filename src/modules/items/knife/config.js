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
  art: new URL("./icon.webp", import.meta.url).href,
  color: "#adc9cc",
  pool: "supply",
  weight: 0,
  model: new URL("./knife.glb", import.meta.url).href,
  permanent: true,
  styles: [
    { id: "standard", name: "制式小刀", translations: { en: { name: "Service Knife" } } },
    {
      id: "tactical",
      name: "战术格斗刀",
      translations: { en: { name: "Tactical Combat" } },
      model: new URL("./styles/tactical.glb", import.meta.url).href,
    },
    {
      id: "damascus",
      name: "大马士革猎刀",
      translations: { en: { name: "Damascus Hunting" } },
      model: new URL("./styles/damascus.glb", import.meta.url).href,
    },
    {
      id: "butterfly",
      name: "蝴蝶刀",
      translations: { en: { name: "Butterfly" } },
      model: new URL("./styles/butterfly.glb", import.meta.url).href,
    },
    {
      id: "karambit",
      name: "爪刀",
      translations: { en: { name: "Karambit" } },
      model: new URL("./styles/karambit.glb", import.meta.url).href,
    },
    {
      id: "scifi",
      name: "科幻匕首",
      translations: { en: { name: "Sci-Fi Dagger" } },
      model: new URL("./styles/scifi.glb", import.meta.url).href,
      glow: "#39e6ff",
    },
  ],
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
