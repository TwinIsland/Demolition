/** In-match coins. They are earned by fighting and spent on building crates. */
export const COINS = {
  coverDestroyed: 4,
  hit: 6,
  zombieKill: { 1: 5, 2: 8, 3: 12 },
  kill: 30,
  /** Paid to whoever destroys someone else's built crate. Far below cost, so building is never a money loop. */
  builtCrateDestroyed: 2,
} as const;

/** Direct crate building: pay coins to build on the cell ahead, without an inventory item. */
export const BUILD = {
  /** Flat price of every crate. */
  cost: 25,
} as const;

/** Player-built crates are always wooden, whatever the map's cover looks like. */
export const BUILT_CRATE_SURFACE = "wood" as const;

/** In-match supply shop: equipment bought with coins at any time, delivered straight to the inventory. */
export const SUPPLY = {
  /** Seconds between two purchases by the same operator. */
  cooldown: 6,
  /** Most units of one item an operator may carry and still buy another. */
  carryLimit: 3,
  /** Each earlier purchase of the same item in this match adds this share to its price. */
  repeatMarkup: 0.25,
} as const;

/** Price of the next unit, given how many of that item the operator has already bought. */
export const supplyCost = (price: number, bought: number) =>
  Math.round(price * (1 + SUPPLY.repeatMarkup * bought));
