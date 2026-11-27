import type { Line } from "./script";

/** Sounds a scene may ask the app for. */
export type StoryCue = "place" | "blast" | "pickup" | "down" | "power" | "pull";

/** What the story needs from the app around it. */
export interface StoryHost {
  typeTick(): void;
  menu(name: "click" | "accept"): void;
  cue(name: StoryCue): void;
  /** Fades the story music out, until the story is left. */
  silence(): void;
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
  dispose(): void;
}
