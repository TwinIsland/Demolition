import type { GameSnapshot, PlayerAgent, PlayerInput, SkillId, StorySetup } from "../core/types";
import type { Camera, Object3D } from "three";
import type { GameRenderer } from "../render/game-renderer";
import type { Line } from "./script";

/** Sounds a scene may ask the app for. */
export type StoryCue =
  | "place"
  | "blast"
  | "pickup"
  | "down"
  | "power"
  | "pull"
  | "goal"
  | "mark"
  | "relicFall"
  | "relicLand"
  | "relicBounce"
  | "relicRise"
  | "relicReveal"
  | "ascendCharge"
  | "ascendHit";

/** Music the story can ask for, by the part it plays under. */
type StoryTrack = "opening" | "duel" | "ascension" | "lesson" | "shutdown" | "home";

/** A lesson names only the HUD elements it needs; true is the full HUD for the final fight. */
export type StoryHudPart =
  | "crosshair"
  | "stamina"
  | "equipment"
  | "shield"
  | "health"
  | "crates"
  | "coins"
  | "skills"
  | "progression"
  | "perks";
export type StoryHud = boolean | readonly StoryHudPart[];
export const storyHudShows = (hud: StoryHud, part: StoryHudPart) =>
  typeof hud === "boolean" ? hud : hud.includes(part);

export interface StoryShopOptions {
  /** Highlight only these skills and require all of them before continuing. */
  requiredSkills?: readonly SkillId[];
}

/**
 * A real match running under the story: the game's own simulation and renderer, with the story
 * holding the strings. Open one through `StoryHost.match`.
 */
export interface StoryMatch {
  /** The live state. Read it at any time; change it only through `mutate`. */
  readonly state: Readonly<GameSnapshot>;
  readonly renderer: GameRenderer;
  /**
   * A group in the match's own 3D scene, emptied when the match closes: a script hangs its props
   * here (writing in the sky, a wall of light) and they are drawn with the world. Positions are
   * world units, see `world` in render/arena.ts.
   */
  readonly scene: Object3D;
  /** The camera the match is drawn with. Read it; the game moves it every frame. */
  readonly camera: Camera;
  /** Edits the world between ticks: move people, add cover, hand out items, revive. */
  mutate(change: (state: GameSnapshot) => void): void;
  /** Hands one of the cast to an agent, or leaves them standing. */
  setAgent(playerId: string, agent?: PlayerAgent): void;
  /** The simulation stands still while set; the picture keeps being drawn. */
  paused: boolean;
  /** Whether the keyboard drives the hero. Off, the hero only does what `gate` returns. */
  control: boolean;
  /** Passes over the hero's input every tick: a lesson uses it to allow one ability at a time. */
  gate?: (input: PlayerInput) => PlayerInput;
  /**
   * How fast the world runs: 1 is the game's own pace, less is slow motion, and 0 holds it still
   * while the scene's own clock (`real` in `onFrame`) goes on. For a shot that plays with time.
   */
  rate: number;
  /**
   * Called once a frame, after the simulation, with the seconds the world advanced and the
   * seconds that really passed. Both are 0 while paused.
   */
  onFrame?: (state: Readonly<GameSnapshot>, dt: number, real: number) => void;
  /** Shows the lesson's named HUD elements, or the whole match HUD with true. Off by default. */
  hud: StoryHud;
  /**
   * The match answers the hero the way a real one does: combat feed, hit markers, the perk offer
   * after a level and its banner. Off by default, for scenes that only stage people.
   */
  live: boolean;
  /** Whether an earned mutation is waiting to show or still displaying its acquisition card. */
  readonly mutationNoticePending: boolean;
  /** Where the first-person camera looks, in radians. Set it to hand the view over from a cutscene. */
  look: { yaw: number; pitch: number };
  /**
   * Opens the game's own skill shop over the scene and resolves once the hero deploys from it,
   * false if the story was closed first. The world stands still meanwhile.
   */
  shop(options?: StoryShopOptions): Promise<boolean>;
}
export interface StoryMatchOptions {
  mapId: string;
  setup: StorySetup;
  /** Skin of the hero, as registered with `registerSkin`. */
  skin: string;
}

/** What the story needs from the app around it. */
export interface StoryHost {
  typeTick(): void;
  menu(name: "click" | "accept"): void;
  cue(name: StoryCue): void;
  /** Fades the story music out, until the story is left or `music` is called. */
  silence(): void;
  music(track: StoryTrack): void;
  match: {
    /** Builds the match behind whatever the stage shows; resolves once it can be drawn. */
    open(options: StoryMatchOptions): Promise<StoryMatch>;
    /** Ends it and puts the menu's backdrop back. */
    close(): void;
  };
  /** The scene is over and its checkpoint saved: return to the menu. */
  finish(): void;
}

/**
 * The shared furniture of every scene: the canvas, the text box, the objective and prompt chips,
 * full-screen art and the end card. A scene player drives it and never touches the DOM itself.
 */
export interface Stage {
  /** Element that carries scene-wide effect classes. */
  readonly root: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly host: StoryHost;
  /**
   * Plays a conversation. The scene is frozen meanwhile unless `live` is set, for words spoken
   * while the world keeps moving. Resolves false if the story was closed in the meantime.
   */
  talk(lines: readonly Line[], options?: { live?: boolean }): Promise<boolean>;
  /** Cuts a live conversation short. */
  interrupt(): void;
  /** Resolves after `ms`, false if the story was closed in the meantime. */
  wait(ms: number): Promise<boolean>;
  /** Sets or clears the objective chip. */
  goal(text?: string): void;
  /** Sets or clears the "examine" prompt. */
  prompt(text?: string): void;
  /**
   * Shows a full-screen illustration, or fades the current one out. A picture comes in after a
   * short hold on whatever was showing, slowly, and one picture dissolves into the next; `cut` is
   * for a picture that lands on a beat. Resolves once it has settled, false if the story was
   * closed in the meantime. A conversation waits for it by itself.
   */
  art(url?: string, options?: { cut?: boolean }): Promise<boolean>;
  /** Adds a canvas covering the stage, above the scene and below the text box, for a cutscene. */
  overlay(): HTMLCanvasElement;
  /** Saves a checkpoint in the middle of an act and shows the save mark; the scene goes on. */
  mark(checkpoint: string): void;
  /**
   * Saves the checkpoint, shows the save mark, and runs on into the next act. After the last act
   * built, the scene stays up with a way back to the menu.
   */
  end(checkpoint: string): void;
}

/** A running scene, as the key handling sees it. */
export interface ScenePlayer {
  /** Resolves when an asynchronous scene has prepared its first world. */
  readonly ready?: Promise<void>;
  /** Direction held on the movement keys; (0, 0) for none. */
  move(x: number, y: number): void;
  /** The action key, pressed while no conversation is open. */
  act(): void;
  /** Set by the stage during a conversation that holds the scene still. */
  frozen: boolean;
  /** Stops the scene's clock, for a dialog laid over the story. Nothing moves or burns down meanwhile. */
  paused: boolean;
  dispose(): void;
}
