/** A rectangle in pixels. On a prop it is relative to the top left of its sprite. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One kind of ground cell. */
export interface Tile {
  solid: boolean;
  /** Flat colour, drawn when the map has no tile sheet. */
  color: string;
  /** Columns of the tile sheet that draw it; with several, cells vary. */
  art?: readonly number[];
  /** Column used instead where a solid cell stands over floor: a wall face with its baseboard. */
  skirt?: number;
}

/**
 * Where a prop is drawn. `floor` lies under everyone (clutter, rugs); `wall` hangs on a wall face;
 * `sorted` stands in the room and is drawn in order of its foot line, in front of or behind a
 * walker; `above` covers everything.
 */
export type PropLayer = "floor" | "wall" | "sorted" | "above";

/** One thing in a room: its own sprite, its own collision, and optionally something to examine. */
export interface Prop {
  id: string;
  /** Top left of the sprite, in map pixels. */
  x: number;
  y: number;
  /** Sprite size. With `frames`, the size of one frame. */
  w: number;
  h: number;
  layer: PropLayer;
  /** What blocks the feet: the base of the object, not its whole picture. None: walked across. */
  box?: Box;
  /** Where it is examined from, when that is not `box` (or the whole sprite). */
  touch?: Box;
  /** Hotspot it opens; one with the prop's own id is used when there is one. */
  hotspot?: string;
  /** How far from `touch` the feet may be, in pixels. */
  reach?: number;
  /** Foot line of a `sorted` prop, in map pixels; the bottom of the sprite when left out. */
  sortY?: number;
  /** Sprite. Without one the prop is a flat `color` block (an indicator light, say), or unseen. */
  art?: string;
  color?: string;
  /** How a sprite sheet is cut. */
  frames?: { columns: number; rows: number };
  /** Frames it plays from the start. */
  loop?: { from: number; to: number; fps: number };
  opacity?: number;
  /** Seconds per on-and-off cycle of a prop that blinks. */
  blink?: number;
  /** Moves in place: `bob` up and down, `shake` side to side, by `amount` pixels every `period` seconds. */
  motion?: { kind: "bob" | "shake"; amount: number; period: number };
  /** Not in the room yet: not drawn, not solid, not examined. */
  hidden?: boolean;
}

/** What a scene may change about a prop while it runs. */
export interface PropChange {
  hidden?: boolean;
  /** A still frame of the sheet. */
  frame?: number;
  /** Frames played in a loop. */
  loop?: Prop["loop"];
}

/** A soft pool of light, drawn over the tinted room. */
export interface Glow {
  x: number;
  y: number;
  radius: number;
  color: string;
  /** How much its brightness wavers, 0 to 1. */
  flicker?: number;
}

/**
 * Daylight through a window, as it lands on the floor: the panes of the window, pushed sideways
 * by the angle of the sun. `x`, `y`, `w` are the top edge of the patch; it is `h` deep and its far
 * edge is `shear` pixels to the right.
 */
export interface Shaft {
  x: number;
  y: number;
  w: number;
  h: number;
  shear: number;
  /** Panes across and down; the bars between them stay dark. */
  columns: number;
  rows: number;
  color: string;
}

/**
 * A room of the 8-bit chapters, built the way tile RPGs are: a grid of ground cells that says
 * where the floor is, and props placed on it in pixels. `rows` holds one character per cell,
 * looked up in `tiles`. The map may be larger than the screen; the view follows the walker.
 */
export interface RpgMap {
  /** Pixels per cell. */
  tile: number;
  rows: readonly string[];
  tiles: Readonly<Record<string, Tile>>;
  /** One row of square cells, `tile` pixels each. */
  tileSheet?: string;
  props: readonly Prop[];
  /** Where the walker's feet start, in map pixels. */
  spawn: { x: number; y: number };
  /** Colour everything is multiplied by, 0 to 255 per channel: the time of day. */
  tint?: readonly [number, number, number];
  glows?: readonly Glow[];
  shafts?: readonly Shaft[];
}
