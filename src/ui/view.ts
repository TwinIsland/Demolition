import type { GameSnapshot, PerkId, Player } from "../core/types";

/** Everything a HUD view may read for one refresh. Views never keep a reference to it. */
export interface HudFrame {
  readonly snapshot: Readonly<GameSnapshot>;
  /** The local player's entry in `snapshot.players`. */
  readonly viewer: Player;
  /** Cell the current throw would land on, when one is being aimed. */
  readonly landing?: { x: number; z: number; valid: boolean };
  readonly selectedPerk?: PerkId;
  readonly browsingPerks: boolean;
}

/**
 * One HUD surface. Its DOM is built once in the constructor; `update` only writes what changed.
 * Views read the current language on every update, so a language switch needs no cache reset.
 */
export interface HudView {
  readonly root: HTMLElement;
  update(frame: HudFrame): void;
  dispose(): void;
}
