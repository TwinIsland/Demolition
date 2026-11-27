import "./story.css";
import { ZERO_PORTRAITS } from "./assets";
import { ACTS } from "./chapters";
import { playArcade } from "./arcade-play";
import { DialogueBox, dialogueMarkup } from "./dialogue";
import { playRoom } from "./room-play";
import { reachCheckpoint } from "./save";
import type { ScenePlayer, Stage, StoryHost } from "./stage";

export type { StoryHost } from "./stage";

export const storyMarkup = () => `
  <div class="story-stage">
    <canvas class="story-canvas"></canvas>
    <div class="story-crt" aria-hidden="true"></div>
    <img class="story-art" alt="" hidden />
    <div class="story-goal" hidden></div>
    <div class="story-prompt" hidden><kbd>E</kbd><span></span></div>
    ${dialogueMarkup}
    <div class="story-title" hidden><small></small><h2></h2></div>
    <div class="story-save" hidden><i></i><span>已保存</span></div>
    <div class="story-card" hidden><span>未完待续</span><small><kbd>E</kbd> 返回主菜单</small></div>
    <div class="story-keys" data-for="room"><span><kbd>WASD</kbd> 移动</span><span><kbd>E</kbd> 调查 / 继续</span><span><kbd>ESC</kbd> 离开</span></div>
    <div class="story-keys" data-for="arcade"><span><kbd>WASD</kbd> 移动</span><span><kbd>空格</kbd> 放泡泡</span><span><kbd>ESC</kbd> 离开</span></div>
  </div>`;

const MOVES: Record<string, readonly [number, number]> = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};
const CONFIRM = new Set(["KeyE", "Space", "Enter"]);
/** How long the "saved" mark stays, and the fade between two acts. */
const SAVE_NOTE_MS = 2600;
const SWITCH_MS = 900;
const TITLE_MS = 2200;

/**
 * Plays an act inside `screen` (the element holding `storyMarkup`) and returns the function that
 * stops it. An act that is not built yet falls back to the first one. This is the stage: the text
 * box, the chips, the keys and the save. What happens on it is up to the scene's player.
 */
export function mountStory(screen: HTMLElement, host: StoryHost, actId?: string, titled = false): () => void {
  let act = ACTS.find((candidate) => candidate.id === actId && candidate.scene) ?? ACTS[0];
  const find = <T extends HTMLElement>(selector: string) => screen.querySelector<T>(selector)!;
  const root = find(".story-stage"),
    goal = find(".story-goal"),
    prompt = find(".story-prompt"),
    card = find(".story-card"),
    saved = find(".story-save"),
    title = find(".story-title"),
    art = find<HTMLImageElement>(".story-art");
  const dialogue = new DialogueBox(
    root,
    { zero: ZERO_PORTRAITS },
    { tick: () => host.typeTick(), move: () => host.menu("click"), accept: () => host.menu("accept") },
  );
  const flags: Record<string, number> = {};
  const held = new Set<string>();
  const timers = new Set<number>();
  /** Empty while the scene is being created: a scene starts talking before it exists here. */
  const running: { player?: ScenePlayer } = {};
  let alive = true,
    ended = false;

  const stage: Stage = {
    root,
    get canvas() {
      return find<HTMLCanvasElement>(".story-canvas");
    },
    host,
    async talk(lines, { live = false } = {}) {
      if (!live && running.player) running.player.frozen = true;
      if (!live) prompt.hidden = true;
      Object.assign(flags, await dialogue.play(lines));
      if (!live && running.player && alive) running.player.frozen = false;
      return alive;
    },
    interrupt: () => dialogue.interrupt(),
    wait: (ms) =>
      new Promise((resolve) => {
        const timer = window.setTimeout(() => {
          timers.delete(timer);
          resolve(alive);
        }, ms);
        timers.add(timer);
      }),
    goal(text) {
      goal.hidden = !text;
      if (text) goal.textContent = `目标：${text}`;
    },
    prompt(text) {
      prompt.hidden = !text;
      if (text) prompt.lastElementChild!.textContent = text;
    },
    art(url) {
      if (url) {
        art.classList.remove("leaving");
        art.src = url;
        art.hidden = false;
      } else if (!art.hidden) {
        art.classList.add("leaving");
        art.addEventListener("animationend", () => (art.hidden = true), { once: true });
      }
    },
    overlay() {
      const canvas = document.createElement("canvas");
      canvas.className = "story-cutscene";
      art.before(canvas);
      return canvas;
    },
    end(checkpoint) {
      reachCheckpoint(checkpoint, flags);
      goal.hidden = prompt.hidden = true;
      if (running.player) running.player.frozen = true;
      saved.hidden = false;
      void stage.wait(SAVE_NOTE_MS).then(() => (saved.hidden = true));
      const next = ACTS[ACTS.indexOf(act) + 1];
      if (next?.scene) void handOver(next);
      else {
        // The last act built so far: the picture stays, with a way out under it.
        card.hidden = false;
        ended = true;
      }
    },
  };
  /** Starts the act's scene on a fresh canvas: a scene's engine does not give its canvas back. */
  const open = () => {
    const scene = act.scene!;
    root.dataset.kind = scene.kind;
    root.classList.remove("booting", "blackout", "pulling");
    art.hidden = true;
    art.classList.remove("leaving");
    const canvas = document.createElement("canvas");
    canvas.className = "story-canvas";
    stage.canvas.replaceWith(canvas);
    // The scene starts out frozen, and its first conversation releases it.
    running.player = undefined;
    running.player = scene.kind === "room" ? playRoom(stage, scene) : playArcade(stage, scene);
    steer();
  };
  /** One act runs into the next behind a short fade, with no stop at the menu. */
  const handOver = async (next: (typeof ACTS)[number]) => {
    root.classList.add("switching");
    if (!(await stage.wait(SWITCH_MS / 2))) return;
    running.player?.dispose();
    act = next;
    open();
    if (await stage.wait(SWITCH_MS / 2)) root.classList.remove("switching");
  };

  const steer = () => {
    let x = 0,
      y = 0;
    for (const code of held) {
      x += MOVES[code][0];
      y += MOVES[code][1];
    }
    running.player?.move(Math.sign(x), Math.sign(y));
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.code === "Escape" || event.metaKey || event.ctrlKey || event.altKey) return;
    if (!(event.code in MOVES) && !CONFIRM.has(event.code) && !/^Digit[1-9]$/.test(event.code)) return;
    event.preventDefault();
    if (event.code in MOVES) {
      held.add(event.code);
      steer();
      if (!event.repeat && dialogue.active) dialogue.navigate(MOVES[event.code][1]);
      return;
    }
    if (event.repeat) return;
    if (event.code.startsWith("Digit")) dialogue.choose(Number(event.code.slice(5)) - 1);
    else if (ended) host.finish();
    else if (dialogue.active) dialogue.confirm();
    else running.player?.act();
  };
  const onKeyUp = (event: KeyboardEvent) => {
    if (held.delete(event.code)) steer();
  };
  const onBlur = () => {
    held.clear();
    steer();
  };
  const onClick = (event: MouseEvent) => {
    if (ended) host.finish();
    else if (dialogue.active && !(event.target as HTMLElement).closest("[data-option]")) dialogue.confirm();
  };
  /** An act picked from the chapter list opens on its name, white on black; played into, it does not. */
  const announce = async () => {
    const [ordinal, name] = act.title.split("\u3000");
    title.querySelector("small")!.textContent = ordinal;
    title.querySelector("h2")!.textContent = name ?? "";
    title.hidden = false;
    if (!(await stage.wait(TITLE_MS))) return;
    open();
    title.classList.add("leaving");
    if (await stage.wait(700)) title.hidden = true;
  };
  if (titled) void announce();
  else open();
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  root.addEventListener("click", onClick);

  return () => {
    alive = false;
    for (const timer of timers) clearTimeout(timer);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
    dialogue.dispose();
    running.player?.dispose();
  };
}
