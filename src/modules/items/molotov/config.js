/** @satisfies {import("../../../core/module-api").ItemConfig} */
const config = {
  translations: {
    en: {
      name: "Molotov",
      description:
        "Lob over cover. It shatters on landing and sets the floor around it alight for 4.5 seconds, burning anyone who stands in the flames, you included.",
    },
  },
  id: "molotov",
  name: "燃烧瓶",
  description: "可高抛越过掩体，落地碎裂并点燃周围地面 4.5 秒，站在火中的任何人都会持续受伤，包括自己。",
  icon: "molotov",
  art: new URL("./icon.webp", import.meta.url).href,
  color: "#f0843c",
  model: new URL("./model.glb", import.meta.url).href,
  weight: 2.6,
  price: 30,
  order: 2,
  pool: "supply",
  throwable: {
    reach: 4,
    flight: 0.6,
    trajectory: "lob",
    landSound: "./assets/glass-shatter.ogg",
    fire: { radius: 1.5, duration: 4.5, damage: 14 },
  },
};

export default config;
