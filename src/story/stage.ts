import type { GameSnapshot, PlayerAgent, PlayerInput, StorySetup } from "../core/types";
import type { GameRenderer } from "../render/game-renderer";
import type { Line } from "./script";

/** Sounds a scene may ask the app for. */
export type StoryCue = "place" | "blast" | "pickup" | "down" | "power" | "pull";

/** Music the story can ask for, by the part it plays under. */
export type StoryTrack = "opening" | "duel" | "ascension" | "lesson";

/**
 * A real match running under the story: the game's own simulation and renderer, with the story
 * holding the strings. Open one through `StoryHost.match`.
 */
export interface StoryMatch {
  /** The live state. Read it at any time; change it only through `mutate`. */
  readonly state: Readonly<GameSnapshot>;
  readonly renderer: GameRenderer;
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
  /** Called once a frame, after the simulation, with the seconds it advanced (0 while paused). */
  onFrame?: (state: Readonly<GameSnapshot>, dt: number) => void;
  /** Shows the match's own HUD (health, coins, equipment). Off by default. */
  hud: boolean;
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
  /** Shows a full-screen illustration, or fades the current one out. */
  art(url?: string): void;
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
