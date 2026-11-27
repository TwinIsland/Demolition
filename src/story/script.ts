import type { Mood } from "./assets";

/** Who a line belongs to. `narrator` and `system` have no portrait; `door` is a voice from off screen. */
export type Speaker = "zero" | "door" | "narrator" | "system" | "aqua" | "cirno";

/** One step of a conversation: a spoken line, or a choice between replies. */
export type Line =
  /** `mood` picks the portrait of a speaker who has several; it stays until the next one given. */
  | { who: Speaker; text: string; mood?: Mood }
  /**
   * A false branch: every option leads to the same next line. `flag` records the pick in the save,
   * for later scenes that want to quote it back.
   */
  | { choice: readonly string[]; flag?: string };

/** Something in a room that can be examined. */
export interface Hotspot {
  id: string;
  /** Layout symbol of the cells that trigger it. */
  symbol: string;
  /** Shown in the prompt while the player faces it. */
  label: string;
  lines: readonly Line[];
  /**
   * Several things in one place, such as the clutter on a desk: each visit examines the next
   * one, in a loop, and `label` and `lines` above are not used.
   */
  cycle?: readonly { label: string; lines: readonly Line[] }[];
  /** Examining it ends the scene, once its lines are read. */
  ends?: boolean;
}

/**
 * A walkable room of the 8-bit chapters: a 320 x 180 painting, and a grid laid over it that says
 * where the player can stand. `layout` is one string per row and one character per cell: "." is
 * floor, "@" the spawn, anything else is solid; a hotspot claims the cells of its symbol.
 */
export interface RoomScene {
  kind: "room";
  id: string;
  /** Painting of the whole room. The grid is centred on it. */
  background: string;
  /** Pixels per layout cell. */
  cell: number;
  layout: readonly string[];
  /** Symbols the player can walk across: clutter on the floor, examined while standing on or at it. */
  walkOver?: string;
  /** A full-screen illustration with lines read over it, before the room appears. */
  opening?: { art: string; lines: readonly Line[] };
  /** Played in the room before the player may move. */
  intro: readonly Line[];
  /** Objective shown once the intro is over. */
  goal: string;
  hotspots: readonly Hotspot[];
  /** Played after the hotspot that ends the scene. */
  outro: readonly Line[];
  /** Checkpoint recorded when the scene ends. */
  checkpoint: string;
  /** Card shown before returning to the menu. */
  endCard: { title: string; note: string };
}

/** Moments of the arcade act that carry lines, in the order they happen. */
export type ArcadeBeat =
  /** Before the first move. */
  | "start"
  /** Spoken while the first bubble's fuse burns; it is cut short by the blast. */
  | "chant"
  /** After that first, self-inflicted defeat. */
  | "chantFailed"
  | "warmup"
  /** On picking up the speed shoe. */
  | "shoe"
  /** The opponent enters. */
  | "duel"
  /** The opponent is beaten: the voice at the door, down to the power cut. */
  | "curfew"
  /** In the dark. */
  | "blackout"
  /** The screen starts to pull. */
  | "pulled"
  /** After the fall into the screen. */
  | "gone";

/**
 * A round of the bubble game played on the old computer: "#" pillar, "c" crate, "." floor, "@" the
 * player's corner and "E" the opponent's. The choreography lives in arcade-play.ts; the scene
 * supplies the board and every line.
 */
export interface ArcadeScene {
  kind: "arcade";
  id: string;
  layout: readonly string[];
  /** Crates to break before the opponent appears. */
  crateGoal: number;
  goals: { first: string; crates: string; duel: string };
  lines: Record<ArcadeBeat, readonly Line[]>;
  /** Illustration shown once the player has been pulled in. */
  goneArt: string;
  checkpoint: string;
  endCard: { title: string; note: string };
}

export type Scene = RoomScene | ArcadeScene;

export const SPEAKER_NAMES: Record<Speaker, string> = {
  zero: "零",
  door: "门外",
  narrator: "",
  system: "系统",
  aqua: "阿库娅",
  cirno: "琪露诺",
};

/** Size of the mini-game's canvas: the proportions of the old monitor's screen. */
export const ARCADE_VIEW = { width: 256, height: 180 } as const;

/** Size of the 8-bit canvas. */
export const VIEW = { width: 320, height: 180 } as const;
