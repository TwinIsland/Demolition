import type { HomeRoom } from "../acts/shutdown";
import { openRoom } from "../room";
import type { Stage } from "../stage";

export interface Walk {
  /** Resolves true once the room has been left by its way on, false if the story was closed. */
  readonly left: Promise<boolean>;
  move(x: number, y: number): void;
  act(): void;
  frozen: boolean;
  paused: boolean;
  dispose(): void;
}

/**
 * One room of the "go back" ending, walked the way act 1's bedroom was: on a fresh 8-bit canvas,
 * with things to examine, and one of them the way on. Unlike act 1 it saves nothing and ends no
 * act; whoever called decides what comes after the door.
 */
export function walkRoom(stage: Stage, room: HomeRoom): Walk {
  // A scene's engine does not give its canvas back, so every room gets its own.
  const canvas = document.createElement("canvas");
  canvas.className = "story-canvas";
  stage.canvas.replaceWith(canvas);
  stage.root.dataset.kind = "room";
  let over = false,
    settle: (left: boolean) => void = () => {};
  const left = new Promise<boolean>((resolve) => (settle = resolve));
  const prompt = () => stage.prompt(play.facing && !play.frozen && !over ? play.facing.label : undefined);
  const play = openRoom(canvas, room, prompt);
  const begin = async () => {
    if (room.intro.length && !(await stage.talk(room.intro))) return;
    play.frozen = false;
    stage.goal(room.goal);
    prompt();
  };
  void begin();
  return {
    left,
    move: (x, y) => play.move(x, y),
    act() {
      const facing = play.facing;
      if (!facing || play.frozen || over) return;
      void stage.talk(facing.lines).then((alive) => {
        if (!alive) return;
        if (!facing.ends) return prompt();
        over = true;
        play.frozen = true;
        stage.goal();
        stage.prompt();
        settle(true);
      });
    },
    get frozen() {
      return play.frozen;
    },
    set frozen(value) {
      play.frozen = value || over;
    },
    get paused() {
      return play.paused;
    },
    set paused(value) {
      play.paused = value;
    },
    dispose() {
      settle(false);
      play.dispose();
    },
  };
}
