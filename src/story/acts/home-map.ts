import { RPG_ART, STORY_ART } from "../assets";
import type { Box, Prop, RpgMap, Tile } from "../rpg/map";
import { SHUTDOWN_ART } from "../shutdown/art";

/**
 * The flat the story starts and ends in, as tile maps: the bedroom with its bathroom (acts 1 and
 * 5), and the dining room (act 5). Sprites come from tools/story/cut-rpg.py; SIZE repeats what it
 * prints. A prop's `hotspot` names an entry of the scene that uses the map; a scene that has no
 * such entry simply leaves the prop as furniture.
 */
const TILE = 16;
/** Wall faces are four cells tall; the floor starts under them. */
const FLOOR_TOP = 64;

/** Columns of the tile sheet. */
const TILES: Record<string, Tile> = {
  "#": { solid: true, color: "#1a1524", art: [7] },
  W: { solid: true, color: "#dfc0ee", art: [4, 4, 5, 4], skirt: 6 },
  T: { solid: true, color: "#f4f4f4", art: [9] },
  S: { solid: true, color: "#0a9a96", art: [10] },
  ".": { solid: false, color: "#a8643a", art: [0, 1, 2, 3] },
  ",": { solid: false, color: "#ddf1fb", art: [8] },
};

const SIZE = {
  bed: [48, 66],
  desk: [58, 50],
  chair: [24, 32],
  bookshelf: [40, 61],
  mirror: [22, 41],
  box: [26, 24],
  "curtains-closed": [80, 55],
  "curtains-open": [80, 55],
  "door-closed": [32, 44],
  "poster-megumin": [32, 42],
  "poster-aqua": [32, 42],
  tissue: [11, 11],
  sock: [12, 13],
  phone: [10, 10],
  crisps: [16, 13],
  clock: [12, 9],
  "power-strip": [17, 6],
  noodles: [11, 14],
  "tissue-box": [14, 10],
  gamepad: [14, 10],
  manga: [13, 12],
  lamp: [14, 17],
  plush: [14, 17],
  toilet: [20, 38],
  sink: [28, 43],
  bathtub: [64, 62],
  washer: [24, 31],
  basket: [20, 21],
  "wall-shelf": [24, 10],
  figurine: [13, 15],
  lockbox: [24, 19],
  "lockbox-open": [24, 25],
  fridge: [26, 49],
  cabinet: [40, 36],
  table: [64, 43],
  "chair-front": [20, 33],
  "chair-back": [20, 31],
  calendar: [26, 33],
  plant: [30, 32],
  window: [64, 43],
} as const satisfies Partial<Record<keyof typeof RPG_ART, readonly [number, number]>>;
type Sprite = keyof typeof SIZE;

type Extra = Partial<Omit<Prop, "id" | "x" | "y" | "w" | "h" | "layer" | "art">>;
const sprite = (
  id: string,
  art: Sprite,
  layer: Prop["layer"],
  x: number,
  y: number,
  extra: Extra = {},
): Prop => ({
  id,
  art: RPG_ART[art],
  w: SIZE[art][0],
  h: SIZE[art][1],
  x,
  y,
  layer,
  ...extra,
});
/** Hangs on the back wall, and is examined from the floor under it. */
const hung = (id: string, art: Sprite, x: number, y: number, extra: Extra = {}) =>
  sprite(id, art, "wall", x, y, { touch: { x: 0, y: 0, w: SIZE[art][0], h: FLOOR_TOP + 6 - y }, ...extra });
/** Stands on the floor; `box` is its base. */
const stands = (id: string, art: Sprite, x: number, y: number, box: Box, extra: Extra = {}) =>
  sprite(id, art, "sorted", x, y, { box, ...extra });
/** Lies on the floor and is walked across. */
const lies = (id: string, art: Sprite, x: number, y: number, extra: Extra = {}) =>
  sprite(id, art, "floor", x, y, extra);
/** A dot of colour: an indicator light, or a patch that blinks over a sprite. */
const dot = (
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  extra: Extra = {},
): Prop => ({
  id,
  x,
  y,
  w,
  h,
  color,
  layer: "above",
  ...extra,
});

const BED_COLUMNS = 18,
  BATH_COLUMNS = 8;
const wallRow = (bedroom: string, bathroom: string) =>
  `#${bedroom.repeat(BED_COLUMNS)}#${bathroom.repeat(BATH_COLUMNS)}#`;
const floorRow = (doorway: boolean) =>
  `#${".".repeat(BED_COLUMNS)}${doorway ? "." : "#"}${",".repeat(BATH_COLUMNS)}#`;

/** Things on the desk are drawn after it, in this order. */
const DESK_FOOT = 158;

/**
 * The bedroom and, through the doorway in its right wall, the bathroom: 464 x 208, wider than the
 * screen. At night the room is tinted and lit by the desk lamp; in the morning the curtains are
 * open, the computer is on the desk, and the box under the bed is unlocked.
 */
export function bedroomMap(time: "night" | "morning"): RpgMap {
  const night = time === "night";
  return {
    tile: TILE,
    tileSheet: RPG_ART.tiles,
    tiles: TILES,
    rows: [
      wallRow("W", "T"),
      wallRow("W", "S"),
      wallRow("W", "T"),
      wallRow("W", "T"),
      floorRow(true),
      floorRow(true),
      ...Array.from({ length: 6 }, () => floorRow(false)),
      "#".repeat(BED_COLUMNS + BATH_COLUMNS + 3),
    ],
    spawn: { x: 184, y: 132 },
    tint: night ? [142, 132, 204] : undefined,
    glows: night
      ? [
          { x: 290, y: 108, radius: 46, color: "#ffc889", flicker: 0.25 },
          { x: 384, y: 112, radius: 84, color: "#dff1ff" },
        ]
      : undefined,
    shafts: night
      ? undefined
      : [{ x: 42, y: FLOOR_TOP + 2, w: 44, h: 58, shear: 34, columns: 2, rows: 2, color: "#fff0b8" }],
    props: [
      // Back wall, left to right.
      hung("curtains", night ? "curtains-closed" : "curtains-open", 24, 5, { hotspot: "window" }),
      hung("megumin", "poster-megumin", 114, 12),
      hung("aqua", "poster-aqua", 152, 12),
      hung("door", "door-closed", 196, 20),
      stands("mirror", "mirror", 238, 26, { x: 0, y: 35, w: 22, h: 6 }),
      stands("shelf", "bookshelf", 262, 7, { x: 0, y: 50, w: 40, h: 11 }),

      // The bed, the plush on it, and what is kept under it.
      stands("bed", "bed", 20, 66, { x: 0, y: 8, w: 48, h: 56 }),
      sprite("cirno", "plush", "sorted", 52, 84, {
        sortY: 133,
        reach: 16,
        motion: { kind: "bob", amount: 1, period: 2.4 },
      }),
      stands(
        "lockbox",
        "lockbox",
        32,
        122,
        { x: 0, y: 10, w: 24, h: 9 },
        { hotspot: "under-bed", hidden: !night },
      ),
      stands(
        "lockbox-open",
        "lockbox-open",
        32,
        116,
        { x: 0, y: 16, w: 24, h: 9 },
        { hotspot: "under-bed", hidden: night },
      ),
      stands("box", "box", 20, 164, { x: 0, y: 10, w: 26, h: 14 }),

      // The desk against the bathroom wall.
      stands("desk", "desk", 244, 108, { x: 1, y: 14, w: 56, h: 34 }, { sortY: DESK_FOOT }),
      sprite("noodles", "noodles", "sorted", 246, 98, { sortY: DESK_FOOT + 1 }),
      sprite("manga", "manga", "sorted", 246, 113, { sortY: DESK_FOOT + 2 }),
      {
        id: "computer",
        art: STORY_ART.computer,
        frames: { columns: 2, rows: 2 },
        x: 257,
        y: 88,
        w: 32,
        h: 32,
        layer: "sorted",
        sortY: DESK_FOOT + 1,
        hidden: night,
      },
      sprite("tissue-box", "tissue-box", "sorted", 262, 117, { sortY: DESK_FOOT + 2 }),
      sprite("gamepad", "gamepad", "sorted", 282, 117, { sortY: DESK_FOOT + 2 }),
      sprite("lamp", "lamp", "sorted", 287, 94, { sortY: DESK_FOOT + 3 }),
      stands("chair", "chair", 261, 150, { x: 3, y: 20, w: 18, h: 10 }),
      lies("power-strip", "power-strip", 284, 180, { reach: 14 }),
      dot("strip-light", 297, 182, 2, 2, "#ff5a4a", { hidden: true }),

      // Clutter.
      lies("tissues", "tissue", 92, 88),
      lies("clock", "clock", 112, 86),
      dot("clock-dark", 114, 89, 8, 3, "#1c0f12", { blink: 1 }),
      lies("phone", "phone", 100, 114),
      lies("sock-left", "sock", 150, 122, { hotspot: "socks" }),
      lies("sock-right", "sock", 212, 170, { hotspot: "socks" }),
      lies("crisps", "crisps", 112, 166),

      // Dust in the morning light.
      {
        id: "dust",
        art: STORY_ART.bedroomDust,
        frames: { columns: 2, rows: 2 },
        x: 50,
        y: 70,
        w: 64,
        h: 40,
        layer: "above",
        loop: { from: 0, to: 3, fps: 4 },
        opacity: 0.55,
        hidden: night,
      },

      // Bathroom.
      stands("sink", "sink", 326, 25, { x: 0, y: 30, w: 28, h: 13 }),
      sprite("wall-shelf", "wall-shelf", "wall", 366, 38),
      hung("figurine", "figurine", 371, 24, { touch: { x: -4, y: 0, w: 21, h: FLOOR_TOP + 6 - 24 } }),
      dot("figurine-glint", 373, 37, 1, 1, "#ffffff", { blink: 1.7 }),
      stands("toilet", "toilet", 410, 32, { x: 1, y: 22, w: 18, h: 16 }),
      stands(
        "washer",
        "washer",
        424,
        100,
        { x: 0, y: 12, w: 24, h: 19 },
        {
          motion: { kind: "shake", amount: 1, period: 0.12 },
        },
      ),
      stands("bathtub", "bathtub", 380, 128, { x: 0, y: 34, w: 64, h: 26 }),
      stands("basket", "basket", 324, 168, { x: 0, y: 9, w: 20, h: 12 }),
    ],
  };
}

/** The dining room: 320 x 192, with the hallway on the left and the kitchen through the right wall. */
export function diningMap(): RpgMap {
  const wall = `#${"W".repeat(18)}#`,
    floor = `#${".".repeat(18)}#`,
    /** Open at both ends: the hallway and the kitchen door. */
    through = ".".repeat(20);
  return {
    tile: TILE,
    tileSheet: RPG_ART.tiles,
    tiles: TILES,
    rows: [wall, wall, wall, wall, floor, floor, floor, through, through, floor, floor, "#".repeat(20)],
    spawn: { x: 30, y: 136 },
    tint: [255, 244, 228],
    glows: [{ x: 316, y: 128, radius: 30, color: "#ffd58a" }],
    shafts: [{ x: 136, y: FLOOR_TOP + 2, w: 48, h: 30, shear: 10, columns: 2, rows: 2, color: "#ffe9a8" }],
    props: [
      stands("fridge", "fridge", 24, 22, { x: 0, y: 38, w: 26, h: 11 }),
      stands("cooker", "cabinet", 58, 35, { x: 0, y: 24, w: 40, h: 12 }),
      dot("cooker-light", 68, 46, 1, 1, "#ff9a3c", { blink: 2.4 }),
      hung("window", "window", 128, 10),
      hung("calendar", "calendar", 232, 14),
      stands("plant", "plant", 264, 40, { x: 8, y: 22, w: 14, h: 10 }),
      stands("chair-far", "chair-front", 150, 76, { x: 2, y: 20, w: 16, h: 10 }, { sortY: 110 }),
      stands("table", "table", 128, 104, { x: 0, y: 12, w: 64, h: 28 }, { reach: 14 }),
      {
        id: "meal",
        art: SHUTDOWN_ART.diningMeal,
        frames: { columns: 2, rows: 2 },
        x: 128,
        y: 92,
        w: 64,
        h: 32,
        layer: "sorted",
        sortY: 148,
        loop: { from: 0, to: 3, fps: 4 },
      },
      stands("chair-near", "chair-back", 150, 134, { x: 2, y: 20, w: 16, h: 10 }),
      // The two ways out are openings, not objects.
      { id: "hallway", x: 0, y: 112, w: 16, h: 32, layer: "floor", reach: 8 },
      { id: "kitchen", x: 304, y: 112, w: 16, h: 32, layer: "floor", reach: 8 },
    ],
  };
}

/** The powered computer's screen: frames of its sheet, played once it is switched on. */
export const COMPUTER_ON = { from: 1, to: 3, fps: 2.5 } as const;
