/** @satisfies {import("../../../core/module-api").ItemConfig} */
const config = {
  translations: {
    en: {
      name: "Field Crate",
      description:
        "Builds a wooden crate on the tile ahead after a 0.6 second windup. Up to 3 of your crates can stand at once. Sold in the supply shop only.",
    },
  },
  id: "crate",
  name: "木箱",
  description: "读条 0.6 秒后在面前一格搭起木箱，最多同时存在 3 个自己的木箱。只在补给商店出售。",
  icon: "crate",
  color: "#c9a26b",
  model: new URL("./model.glb", import.meta.url).href,
  // Never dropped: crates come from the supply shop.
  weight: 0,
  price: 20,
  order: 9,
  pool: "supply",
};

export default config;
