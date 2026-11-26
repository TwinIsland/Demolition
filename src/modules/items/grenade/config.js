/** @satisfies {import("../../../core/module-api").ItemConfig} */
const config = {
  translations: {
    en: {
      name: "Frag Grenade",
      description:
        "Lob over walls and cover. Lands on a clear tile within four tiles and explodes on impact at 75% of your charge power.",
    },
  },
  id: "grenade",
  name: "破片手榴弹",
  description: "高抛越过墙壁和掩体，落在四格内的空地，落地即爆，威力为炸药的 75%。",
  icon: "grenade",
  color: "#deb36f",
  model: new URL("./model.glb", import.meta.url).href,
  weight: 2.4,
  price: 35,
  order: 1,
  pool: "supply",
  throwable: { reach: 4, flight: 0.6, blastRange: 2, powerScale: 0.75, trajectory: "lob" },
};

export default config;
