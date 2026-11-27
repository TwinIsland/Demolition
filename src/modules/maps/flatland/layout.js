// The Flatland starter village, cell by cell. The layout never changes: story mode teaches on it
// in the overhead view (act 3), stands it up in 3D (act 4) and fights the last match on it (act 5).
//
// Open ground:   .  grass     ,  flagstone path     +  cobbled plaza     :  tilled earth
// Destructible:  c  wooden crate     f  plank fence     o  anything from the village pool
// Permanent:     #  boundary wall    w  low dry-stone wall    L  stone lantern    F  fountain
//                W  well    T  cherry tree    R  garden rock    G  gravestone    B  notice board
//                t  torii post (two posts carry one gate over the cell between them)
//                K  farmhouse    D  dojo    M  shop    H  cottage    S  shrine
export const LAYOUT = [
  "#####################",
  "#...c,,,,c,oDDDDc...#",
  "#..Bwwwww.c.DDDDoc..#",
  "#.c.......,.o.oc..c.#",
  "#c.KKK.T.t,t.LoL.Loc#",
  "#..KKK..o.,.o..o.o..#",
  "#.o..offf.o..LoL.L.o#",
  "#.L.W.o..,,,o...o.c.#",
  "#...o..cL+++L.o.c.o.#",
  "#o.c..o.+++++o.c...o#",
  "#,,c,,o,++F++,o,,c,,#",
  "#.o....o+++++.o.G.G.#",
  "#o..,.c.L+++Lo.c.o.o#",
  "#..MMM.o..,.o..TG.G.#",
  "#c.MMMo.c.,ot.L..SSc#",
  "#.o....f..,,,,,,,SS.#",
  "#::o:f.T..o.toL.oSS.#",
  "#.::ofo.c.,c..oT.c..#",
  "#..::f.HH.,.oR..o...#",
  "#...c.oHH.,.c.oc....#",
  "#####################",
];
export const SIZE = LAYOUT.length;

/** @type {(x: number, z: number) => string} */
export const symbolAt = (x, z) => LAYOUT[z]?.[x] ?? "#";

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
 * What stands on a wall cell, for the renderer. A building reads
 * `<kind>:<width>x<depth>:<column>,<row>:<front>`, so every cell knows which part of it to draw.
 * @type {(x: number, z: number) => string | undefined}
 */
export function featureAt(x, z) {
  const symbol = symbolAt(x, z);
  if (symbol === "#") {
    const middle = (SIZE - 1) / 2;
    // A roofed gate closes each end of the two main streets.
    return (x === middle || z === middle) && (x === 0 || z === 0 || x === SIZE - 1 || z === SIZE - 1)
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
export function tileAt(x, z) {
  const symbol = symbolAt(x, z);
  if (".,+:".includes(symbol)) return 0;
  return "cfo".includes(symbol) ? 2 : 1;
}

/** @type {(x: number, z: number) => "grass" | "stone" | "mud"} */
export function groundAt(x, z) {
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
export function obstacleAt(x, z) {
  const symbol = symbolAt(x, z);
  if (symbol === "c") return { use: "crate" };
  if (symbol === "f")
    return { use: "wood-fence", turn: symbolAt(x, z - 1) === "f" || symbolAt(x, z + 1) === "f" ? 1 : 0 };
}

/**
 * Cells the story script refers to, so that no act hard-codes coordinates of its own.
 * `x` runs east and `z` south, both from 0 at the boundary wall.
 */
export const SPOTS = {
  /** Where the hero wakes up, and where the guide waits beside him. */
  arrival: { x: 1, z: 1 },
  guide: { x: 2, z: 2 },
  /** The roofed notice board: "欢迎来到平面国". Permanent, so it doubles as the wall to bomb in vain. */
  notice: { x: 3, z: 2 },
  /** The three crates that close the arrival nook (3.1). */
  firstCrates: [
    { x: 4, z: 1 },
    { x: 2, z: 3 },
    { x: 1, z: 4 },
  ],
  /** An open stretch for the chain lesson (3.2): two charges in one row. */
  chainLane: { from: { x: 3, z: 3 }, to: { x: 8, z: 3 } },
  /** Kick a charge from `from` eastwards; the crate at `target` is five cells away (3.2). */
  kickLane: { from: { x: 5, z: 1 }, target: { x: 9, z: 1 } },
  /** The low wall beside the kick lane: throw over it from the lane into the yard (4.2). */
  lowWall: { from: { x: 4, z: 2 }, to: { x: 8, z: 2 } },
  /** The dojo yard with its grid of stone lanterns: the duel with the sample opponent (3.4). */
  dojo: { from: { x: 12, z: 3 }, to: { x: 19, z: 8 }, opponent: { x: 16, z: 5 }, door: { x: 13, z: 3 } },
  /** The fountain plaza: the 2D to 3D reveal reads best from its north side, looking south. */
  plaza: { centre: { x: 10, z: 10 }, reveal: { x: 10, z: 7 } },
  /** The skill shop's counter and the cell a customer stands on (4.3). */
  shop: { counter: { x: 4, z: 13 }, customer: { x: 4, z: 12 } },
  /** The farm plot behind the shop: room for training dummies (4.3). */
  trainingYard: { from: { x: 1, z: 15 }, to: { x: 4, z: 18 } },
  /** The graveyard north of the shrine, where the ground opens (4.4). */
  graves: [
    { x: 17, z: 11 },
    { x: 19, z: 11 },
    { x: 17, z: 13 },
    { x: 19, z: 13 },
    { x: 17, z: 12 },
  ],
  shrine: { front: { x: 16, z: 15 }, approach: { x: 11, z: 15 } },
};
