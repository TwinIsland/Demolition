// The small Flatland the story is told on: the same village as `../flatland`, drawn on 15 × 15 so
// that every lesson is a few steps from the last one. The arrival corner (the first three rows,
// up to column 9) is cell for cell the one of the full map.
//
// Open ground:   .  grass     ,  flagstone path     +  cobbled plaza     :  tilled earth
// Destructible:  c  wooden crate     f  plank fence     o  anything from the village pool
// Permanent:     #  boundary wall    w  low dry-stone wall    L  stone lantern    F  fountain
//                T  cherry tree    G  gravestone    B  notice board
//                t  torii post (two posts carry one gate over the cell between them)
//                D  dojo    M  shop    S  shrine
import { villagePlan } from "../flatland/plan.js";

export const LAYOUT = [
  "###############",
  "#...c,,,,cDDDD#",
  "#..Bwwwww.DDDD#",
  "#.c.......,...#",
  "#c...Tt,t.LoL.#",
  "#.o..o.,...o..#",
  "#..o.L+++Lo.L.#",
  "#,,c,,+F+,,o,,#",
  "#....L+++L.G.G#",
  "#.MMM.o,.c....#",
  "#.MMM..,o.TG.G#",
  "#::::f.,.ot.SS#",
  "#::::f.,,,,,SS#",
  "#::::..,c.t.SS#",
  "###############",
];
export const SIZE = LAYOUT.length;

export const { symbolAt, featureAt, tileAt, groundAt, obstacleAt } = villagePlan(LAYOUT);

/**
 * Cells the story script refers to: the same names as the full map's `SPOTS`, so an act moves
 * between the two by changing its import. `x` runs east and `z` south, from 0 at the boundary wall.
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
  /** Kick a charge from `from` eastwards; the crate at `target` stops it (3.2). */
  kickLane: { from: { x: 5, z: 1 }, target: { x: 9, z: 1 } },
  /** The low wall beside the kick lane: throw over it from the lane into the street (4.2). */
  lowWall: { from: { x: 4, z: 2 }, to: { x: 8, z: 2 } },
  /**
   * The dojo yard and its stone lanterns: the duel with the sample opponent (3.4). The two stand
   * at the ends of row 5 with one breakable between them; the guide watches from the street.
   */
  dojo: {
    from: { x: 9, z: 3 },
    to: { x: 13, z: 6 },
    hero: { x: 9, z: 5 },
    opponent: { x: 13, z: 5 },
    guide: { x: 8, z: 5 },
    door: { x: 11, z: 3 },
  },
  /** The fountain plaza: the 2D to 3D reveal reads best from its north side, looking south. */
  plaza: { centre: { x: 7, z: 7 }, reveal: { x: 7, z: 5 } },
  /** The skill shop's counter and the cell a customer stands on (4.3). */
  shop: { counter: { x: 3, z: 9 }, customer: { x: 3, z: 8 } },
  /** The farm plot behind the shop: room for training dummies (4.3). */
  trainingYard: { from: { x: 1, z: 11 }, to: { x: 4, z: 13 } },
  /** The graveyard north of the shrine; the last entry is the open ground between the stones (4.4). */
  graves: [
    { x: 11, z: 8 },
    { x: 13, z: 8 },
    { x: 11, z: 10 },
    { x: 13, z: 10 },
    { x: 12, z: 9 },
  ],
  shrine: { front: { x: 11, z: 12 }, approach: { x: 7, z: 12 } },
};
