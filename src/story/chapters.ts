import { BEDROOM } from "./acts/bedroom";
import { hasCheckpoint, type StorySave } from "./save";
import type { Scene } from "./script";
import { BUBBLE_X } from "./acts/bubble-x";

/** One act of the story, as the menu lists it. */
export interface Act {
  id: string;
  title: string;
  /** Checkpoint that unlocks the act; the first act has none. */
  requires?: string;
  /** Checkpoint reached by finishing it. */
  completes: string;
  /** Absent while the act is not built yet. */
  scene?: Scene;
}

/** The acts of "Ascension", in order. Saves refer to them by checkpoint, never by position. */
export const ACTS: readonly Act[] = [
  { id: "act1", title: "第一幕　凡俗的牢笼", completes: "act1-done", scene: BEDROOM },
  { id: "act2", title: "第二幕　泡泡 X", requires: "act1-done", completes: "act2-done", scene: BUBBLE_X },
  { id: "act3", title: "第三幕　平面国", requires: "act2-done", completes: "act3-done" },
  { id: "act4", title: "第四幕　升维", requires: "act3-done", completes: "act4-done" },
  { id: "act5", title: "第五幕　关机", requires: "act4-done", completes: "act5-fight" },
];

export const actUnlocked = (act: Act, save: StorySave) => !act.requires || hasCheckpoint(save, act.requires);
export const actPlayable = (act: Act, save: StorySave) => !!act.scene && actUnlocked(act, save);
export const actDone = (act: Act, save: StorySave) => hasCheckpoint(save, act.completes);

/** Where "continue" resumes: the first act not finished yet. Undefined once the whole story is done. */
export const nextAct = (save: StorySave): Act | undefined => ACTS.find((act) => !actDone(act, save));
