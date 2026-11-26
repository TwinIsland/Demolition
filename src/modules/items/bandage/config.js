/** @satisfies {import("../../../core/module-api").ItemConfig} */
const config = {
  id: "bandage",
  name: "绷带",
  description: "使用后恢复 30 点生命值。满血时保留绷带。",
  translations: {
    en: { name: "Bandage", description: "Restore 30 HP. Kept in your inventory at full health." },
  },
  icon: "bandage",
  color: "#badfb8",
  model: new URL("./model.glb", import.meta.url).href,
  order: 9,
  pool: "supply",
  weight: 3,
  price: 25,
  stats: { heal: 30 },
  sound: new URL("./use.ogg", import.meta.url).href,
};

export default config;
