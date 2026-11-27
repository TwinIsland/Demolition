/** In-match coins. They are earned by fighting and spent in the supply shop. */
export const COINS = {
  coverDestroyed: 4,
  hit: 6,
  zombieKill: { 1: 5, 2: 8, 3: 12 },
  kill: 30,
  /** Paid to whoever destroys someone else's built crate. A token sum: crates are a free, limited stock. */
  builtCrateDestroyed: 2,
} as const;

/**
 * Direct crate building, without coins or an inventory item. Every operator carries a stock of
 * crates set by level; building spends one and each level-up refills the stock.
 */
export const BUILD = {
  /** Crates carried at level 1. */
  baseStock: 3,
  /** Extra crates per level above the first. */
  stockPerLevel: 1,
  /** Largest stock an operator can hold, from levels and salvage together. */
  maxStock: 8,
  /** Crates gained by destroying another operator's crate; this may exceed the level's own stock. */
  salvage: 1,
} as const;

/** Full crate stock of an operator at `level`. */
export const crateStock = (level: number) =>
  Math.min(BUILD.maxStock, BUILD.baseStock + BUILD.stockPerLevel * Math.max(0, level - 1));

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
