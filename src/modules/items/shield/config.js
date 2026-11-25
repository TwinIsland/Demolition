/** @satisfies {import("../../../core/module-api").ItemConfig} */
const config = {
  translations: { en: {
    name: "Tactical Shield",
    description: "Blocks melee and zombie attacks for up to 4 seconds. The first blast it absorbs shatters the shield.",
  } },
  id: "shield",
  name: "战术护盾",
  description: "展开护盾，最多持续 4 秒，可抵挡近战和僵尸攻击。挡住一次爆炸后立即破碎。",
  icon: "shield",
  quickEquipCode: "KeyX",
  sound: "./assets/shield-on.ogg",
  shieldSounds: {
    broken:new URL("./break.ogg",import.meta.url).href,
    expired:new URL("./expire.ogg",import.meta.url).href,
  },
  color: "#f4d58d",
  model: new URL("./model.glb",import.meta.url).href,
  weight: 3.4,
  order: 8,
  pool: "supply",
  stats: { duration: 4 },
};

export default config;
