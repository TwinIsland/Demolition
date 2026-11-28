import type { Mood } from "./assets";
import type { RpgMap } from "./rpg/map";
import type { ScenePlayer, Stage } from "./stage";

/** Who a line belongs to. `narrator` and `system` have no portrait; `door` is a voice from off screen. */
export type Speaker = "zero" | "door" | "narrator" | "system" | "aqua" | "cirno" | "lulu" | "zhangsan";

/** One step of a conversation: a spoken line, or a choice between replies. */
export type Line =
  /** `mood` picks the portrait of a speaker who has several; it stays until the next one given. */
  | { who: Speaker; text: string; mood?: Mood }
  /**
   * A false branch: every option leads to the same next line. `flag` records the pick in the save,
   * for later scenes that want to quote it back.
   */
  | { choice: readonly string[]; flag?: string };

/** Something in a room that can be examined: the prop of the room's map that names its `id` opens it. */
export interface Hotspot {
  id: string;
  /** Shown in the prompt while the player is at it. */
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
 * A walkable room of the 8-bit chapters: a map of ground tiles and props (see rpg/map.ts), and
 * what there is to say about the things in it.
 */
export interface RoomScene {
  kind: "room";
  id: string;
  map: RpgMap;
  /** Optional room-specific interaction sequence, sharing the same room renderer. */
  play?(stage: Stage): ScenePlayer;
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
}

/** Moments of the arcade act that carry lines, in the order they happen. */
type ArcadeBeat =
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
}

/**
 * A scene that brings its own player: the acts staged on the real game (see match/staged-match.ts)
 * are written as a script of their own rather than as data for a shared one.
 */
export interface StagedScene {
  kind: "staged";
  id: string;
  play(stage: Stage): ScenePlayer;
}

export type Scene = RoomScene | ArcadeScene | StagedScene;

export const SPEAKER_NAMES: Record<Speaker, string> = {
  zero: "零",
  door: "门外",
  narrator: "",
  system: "系统",
  aqua: "阿库娅",
  cirno: "琪露诺",
  lulu: "露露",
  zhangsan: "张三",
};

/** Size of the mini-game's canvas: the proportions of the old monitor's screen. */
export const ARCADE_VIEW = { width: 256, height: 180 } as const;

/** Size of the 8-bit canvas. */
export const VIEW = { width: 320, height: 180 } as const;
