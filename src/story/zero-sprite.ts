import type { KAPLAYCtx } from "kaplay";
import { STORY_ART } from "./assets";

/** Rows of the walk sheet, top to bottom; each holds four 16 x 32 frames. */
export const FACINGS = ["down", "up", "left", "right"] as const;
export type Facing = (typeof FACINGS)[number];
const FRAMES = 4;

export const HEADING: Record<Facing, readonly [number, number]> = {
  down: [0, 1],
  up: [0, -1],
  left: [-1, 0],
  right: [1, 0],
};

/** Which way a walker faces for a movement direction; `current` is kept while standing. */
export const facingOf = (mx: number, my: number, current: Facing): Facing =>
  !mx && !my ? current : Math.abs(mx) > Math.abs(my) ? (mx < 0 ? "left" : "right") : my < 0 ? "up" : "down";

/** How the walk sheet is cut: `idle-<facing>` and `walk-<facing>` animations. */
const walkSheet = {
  sliceX: FRAMES,
  sliceY: FACINGS.length,
  anims: Object.fromEntries(
    FACINGS.flatMap((facing, row) => [
      [`idle-${facing}`, row * FRAMES],
      [`walk-${facing}`, { from: row * FRAMES, to: row * FRAMES + FRAMES - 1, loop: true, speed: 8 }],
    ]),
  ),
};

/** Registers Zero's walk sheet as the sprite "zero". */
export function loadZeroSprite(k: KAPLAYCtx) {
  k.loadSprite("zero", STORY_ART.zeroWalk, walkSheet);
}
