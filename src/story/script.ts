/** Who a line belongs to. `narrator` and `system` have no portrait; `door` is a voice from off screen. */
export type Speaker = "zero" | "door" | "narrator" | "system";

/** One step of a conversation: a spoken line, or a choice between replies. */
export type Line =
  | { who: Speaker; text: string }
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
  /** Examining it ends the scene, once its lines are read. */
  ends?: boolean;
}

/**
 * A walkable room of the 8-bit chapters. `layout` is one string per row and one character per
 * 16-pixel cell: "." is floor, "@" the spawn, any other symbol is solid and names its tile art.
 */
export interface RoomScene {
  id: string;
  layout: readonly string[];
  /**
   * Painting of the whole room, 320 x 180. With one, tiles are not drawn and the layout only
   * supplies collision and hotspots.
   */
  background?: string;
  /** Played before the player may move. */
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

export const SPEAKER_NAMES: Record<Speaker, string> = {
  zero: "零",
  door: "门外",
  narrator: "",
  system: "系统",
};

/** Pixels per layout cell, and the size of the 8-bit canvas. */
export const CELL = 16;
export const VIEW = { width: 320, height: 180 } as const;
