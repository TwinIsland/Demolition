// Reads a village plan drawn in characters, for the maps that share the Flatland look. See
// `layout.js` for the alphabet.

/**
 * Buildings by symbol: what it is and which way its entrance looks. A house or the training
 * ground has one symbol per direction, so that a plan can turn it towards its own street.
 * @type {Record<string, readonly [string, string]>}
 */
const BUILDING = {
  K: ["tavern", "s"],
  D: ["dojo", "s"],
  E: ["dojo", "n"],
  M: ["shop", "n"],
  H: ["house", "s"],
  J: ["house", "n"],
  I: ["cottage", "s"],
  U: ["cottage", "n"],
  S: ["shrine", "w"],
  N: ["smithy", "e"],
  Y: ["windmill", "e"],
};
/** @type {Record<string, string>} */
const FEATURE = {
  w: "low-wall",
  L: "lantern",
  F: "fountain",
  X: "jukebox",
  T: "tree",
  R: "rock",
  G: "grave",
  B: "notice",
};

/**
 * The map callbacks of one plan: a square of rows, one character per cell.
 * @param {readonly string[]} layout
 */
export function villagePlan(layout) {
  const size = layout.length;
  /** @type {(x: number, z: number) => string} */
  const symbolAt = (x, z) => layout[z]?.[x] ?? "#";

  /**
   * What stands on a wall cell, for the renderer. A building reads
   * `<kind>:<width>x<depth>:<column>,<row>:<front>`, so every cell knows which part of it to draw.
   * @type {(x: number, z: number) => string | undefined}
   */
  function featureAt(x, z) {
    const symbol = symbolAt(x, z);
    if (symbol === "#") {
      const middle = (size - 1) / 2;
      // A gatehouse closes each end of the two main streets.
      return (x === middle || z === middle) && (x === 0 || z === 0 || x === size - 1 || z === size - 1)
        ? "gate"
        : undefined;
    }
    if (symbol === "t") {
      // The second pier of a pair stands two cells east or south of the first.
      if (symbolAt(x + 2, z) === "t") return "arch:x:0";
      if (symbolAt(x - 2, z) === "t") return "arch:x:1";
      return symbolAt(x, z + 2) === "t" ? "arch:z:0" : "arch:z:1";
    }
    // Open cells are named too, for the painter of the ground: the plaza is cobbled.
    if (symbol === "+") return "plaza";
    const building = BUILDING[symbol];
    if (!building) return FEATURE[symbol];
    let left = x,
      right = x,
      top = z,
      bottom = z;
    while (symbolAt(left - 1, z) === symbol) left--;
    while (symbolAt(right + 1, z) === symbol) right++;
    while (symbolAt(x, top - 1) === symbol) top--;
    while (symbolAt(x, bottom + 1) === symbol) bottom++;
    return `${building[0]}:${right - left + 1}x${bottom - top + 1}:${x - left},${z - top}:${building[1]}`;
  }

  /** @type {(x: number, z: number) => 0 | 1 | 2} */
  function tileAt(x, z) {
    const symbol = symbolAt(x, z);
    if (".,+:".includes(symbol)) return 0;
    return "cfo".includes(symbol) ? 2 : 1;
  }

  /** @type {(x: number, z: number) => "grass" | "stone" | "mud"} */
  function groundAt(x, z) {
    const symbol = symbolAt(x, z);
    if (symbol === ":") return "mud";
    if (",+FX".includes(symbol)) return "stone";
    // A lantern at the plaza's edge stands on its cobbles; one by the road stands in the grass.
    if (symbol === "L")
      return [symbolAt(x - 1, z), symbolAt(x + 1, z), symbolAt(x, z - 1), symbolAt(x, z + 1)].includes("+")
        ? "stone"
        : "grass";
    // A crate or a cart left on a road stands on the road: the road runs on underneath it.
    const road = (/** @type {number} */ dx, /** @type {number} */ dz) =>
      ",+".includes(symbolAt(x + dx, z + dz));
    if ("cfo".includes(symbol) && ((road(-1, 0) && road(1, 0)) || (road(0, -1) && road(0, 1))))
      return "stone";
    return "grass";
  }

  /**
   * The obstacle a destructible cell always shows. Crates are the ones the tutorial points at;
   * a fence follows the row it stands in.
   * @type {(x: number, z: number) => { use: string, turn?: number } | undefined}
   */
  function obstacleAt(x, z) {
    const symbol = symbolAt(x, z);
    if (symbol === "c") return { use: "village-crate" };
    if (symbol === "f")
      return { use: "wood-fence", turn: symbolAt(x, z - 1) === "f" || symbolAt(x, z + 1) === "f" ? 1 : 0 };
  }

  return { size, symbolAt, featureAt, tileAt, groundAt, obstacleAt };
}
