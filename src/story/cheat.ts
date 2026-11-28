import { ACTS, nextAct } from "./chapters";
import { forgetIllustrations, grantIllustrations } from "./gallery";
import { grantCheckpoints, loadStory, wipeStory } from "./save";
import { forgetEndings, grantEndings } from "./shutdown/unlocks";
import { forgetStoryCleared } from "./unlocks";

/** Up, up, down, down, left, right, left, right, B, A: `KeyboardEvent.code` values. */
const CODE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "KeyB",
  "KeyA",
] as const;

/** Follows key presses and reports when the cheat code has just been completed. */
export class CheatCode {
  private matched = 0;

  press(code: string): boolean {
    if (code === CODE[this.matched]) this.matched += 1;
    // A third Up in a row still leaves two Ups entered; any other miss starts over.
    else if (!(code === "ArrowUp" && this.matched === 2)) this.matched = code === CODE[0] ? 1 : 0;
    if (this.matched < CODE.length) return false;
    this.matched = 0;
    return true;
  }

  reset() {
    this.matched = 0;
  }
}

/**
 * The cheat's effect, alternating: with anything left to earn it marks every act finished and
 * hands out both endings and the whole gallery; once everything is finished it wipes the story
 * and all it ever unlocked. Returns true when it unlocked, false when it wiped.
 */
export function toggleStoryCheat(): boolean {
  if (nextAct(loadStory())) {
    // Only the acts' closing checkpoints: a mid-act one would make that act resume half-way.
    grantCheckpoints(ACTS.map((act) => act.completes));
    grantEndings();
    grantIllustrations();
    return true;
  }
  wipeStory();
  forgetStoryCleared();
  forgetEndings();
  forgetIllustrations();
  return false;
}
