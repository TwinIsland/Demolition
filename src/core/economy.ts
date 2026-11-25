/** In-match coins. They are earned by fighting and spent on building crates. */
export const COINS = {
  coverDestroyed: 4,
  hit: 6,
  zombieKill: { 1: 5, 2: 8, 3: 12 },
  kill: 30,
  /** Paid to whoever destroys a player-built crate. Far below cost, so building is never a money loop. */
  builtCrateDestroyed: 2,
} as const;

/** Direct crate building: pay coins to build on the cell ahead, without an inventory item. */
export const BUILD = {
  cost: 20,
  /** Each crate an operator has built this match raises their next price. */
  costStep: 5,
  /** Seconds of uninterrupted building; taking damage cancels it. */
  windup: 0.6,
} as const;

/** Player-built crates are always wooden, whatever the map's cover looks like. */
export const BUILT_CRATE_SURFACE = "wood" as const;

export const crateCost = (built: number) => BUILD.cost + BUILD.costStep * built;

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
