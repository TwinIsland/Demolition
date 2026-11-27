// Reads a village plan drawn in characters, for the maps that share the Flatland look. See
// `layout.js` for the alphabet.

/** @type {Record<string, string>} */
const BUILDING = { K: "farmhouse", D: "dojo", M: "shop", H: "cottage", S: "shrine" };
/** Which way each building's entrance looks: towards the street it stands on. */
/** @type {Record<string, string>} */
const FRONT = { K: "s", D: "s", M: "n", H: "w", S: "w" };
/** @type {Record<string, string>} */
const FEATURE = {
  w: "low-wall",
  L: "lantern",
  F: "fountain",
  W: "well",
  T: "cherry",
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
      // A roofed gate closes each end of the two main streets.
      return (x === middle || z === middle) && (x === 0 || z === 0 || x === size - 1 || z === size - 1)
        ? "gate"
        : undefined;
    }
    if (symbol === "t") {
      // The second post of a pair stands two cells east or south of the first.
      if (symbolAt(x + 2, z) === "t") return "torii:x:0";
      if (symbolAt(x - 2, z) === "t") return "torii:x:1";
      return symbolAt(x, z + 2) === "t" ? "torii:z:0" : "torii:z:1";
    }
    const kind = BUILDING[symbol];
    if (!kind) return FEATURE[symbol];
    let left = x,
      right = x,
      top = z,
      bottom = z;
    while (symbolAt(left - 1, z) === symbol) left--;
    while (symbolAt(right + 1, z) === symbol) right++;
    while (symbolAt(x, top - 1) === symbol) top--;
    while (symbolAt(x, bottom + 1) === symbol) bottom++;
    return `${kind}:${right - left + 1}x${bottom - top + 1}:${x - left},${z - top}:${FRONT[symbol]}`;
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
    // Lanterns, the fountain and the notice board stand on the paving around them.
    if (",+LFB".includes(symbol)) return "stone";
    return "grass";
  }

  /**
   * The obstacle a destructible cell always shows. Crates are the ones the tutorial points at;
   * a fence follows the row it stands in.
   * @type {(x: number, z: number) => { use: string, turn?: number } | undefined}
   */
  function obstacleAt(x, z) {
    const symbol = symbolAt(x, z);
    if (symbol === "c") return { use: "crate" };
    if (symbol === "f")
      return { use: "wood-fence", turn: symbolAt(x, z - 1) === "f" || symbolAt(x, z + 1) === "f" ? 1 : 0 };
  }

  return { size, symbolAt, featureAt, tileAt, groundAt, obstacleAt };
}
