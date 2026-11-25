/** @satisfies {import("../../../core/module-api").ItemConfig} */
const config = {
  translations: {
    en: {
      name: "Smoke Grenade",
      description: "Lob over cover to create a smoke screen that lasts 6 seconds.",
    },
  },
  id: "smoke",
  name: "烟雾弹",
  description: "可高抛越过掩体，在落点形成持续 6 秒的烟幕。",
  icon: "smoke",
  color: "#acbdc4",
  model: new URL("./model.glb", import.meta.url).href,
  weight: 2.8,
  price: 20,
  order: 2,
  pool: "supply",
  throwable: { reach: 4, flight: 0.55, trajectory: "lob" },
  stats: { duration: 6, radius: 1.65 },
};

export default config;
