/** @satisfies {import("../../../core/module-api").ItemConfig} */
const config = {
  translations: { en: {
    name: "Frag Grenade",
    description: "Lob over walls and cover. Explodes on landing in a clear tile within four tiles.",
  } },
  id: "grenade",
  name: "破片手榴弹",
  description: "高抛越过墙壁和掩体，在四格内的空地落地爆炸。",
  icon: "grenade",
  color: "#deb36f",
  model: new URL("./model.glb",import.meta.url).href,
  weight: 3.2,
  order: 1,
  pool: "supply",
  throwable: { reach: 4, flight: 0.60, blastRange: 2, trajectory: "lob" },
};

export default config;
