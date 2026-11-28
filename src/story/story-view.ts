import "./story.css";
import "./hud.css";
import { LULU_PORTRAITS, ZERO_PORTRAITS, ZHANGSAN_PORTRAITS } from "./assets";
import { ACTS } from "./chapters";
import { playArcade } from "./arcade-play";
import { DialogueBox, dialogueMarkup } from "./dialogue";
import { playRoom } from "./room-play";
import { reachCheckpoint } from "./save";
import { unlockIllustration } from "./gallery";
import { t } from "../i18n";
import type { ScenePlayer, Stage, StoryHost } from "./stage";

export type { StoryHost } from "./stage";

/** The running story, as the app holds it. */
export interface StoryHandle {
  readonly actId: string;
  /** Holds the story still under a dialog: no keys reach it and the scene's clock stops. */
  pause(on: boolean): void;
  stop(): void;
}

export const storyMarkup = () => `
  <div class="story-stage">
    <canvas class="story-canvas"></canvas>
    <div class="story-crt" aria-hidden="true"></div>
    <img class="stage-art" alt="" hidden />
    <div class="story-goal" hidden></div>
    <div class="story-prompt" hidden><kbd>E</kbd><span></span></div>
    ${dialogueMarkup}
    <div class="story-title" hidden><small></small><h2></h2></div>
    <div class="story-save" hidden><i></i><span>已保存</span></div>
    <div class="story-card" hidden><span>未完待续</span><small><kbd>E</kbd> 返回主菜单</small></div>
    <div class="story-keys" data-for="room"><span><kbd>WASD</kbd> 移动</span><span><kbd>E</kbd> 调查 / 继续</span></div>
    <div class="story-keys" data-for="staged"><span><kbd>WASD</kbd> 移动</span><span><kbd>空格</kbd> 放炸药</span></div>
    <div class="story-keys" data-for="arcade"><span><kbd>WASD</kbd> 移动</span><span><kbd>空格</kbd> 放泡泡</span></div>
    <div class="story-pause-hint"><kbd>ESC</kbd><span>${t("暂停")}</span></div>
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
 * An illustration's entrance: the scene before it holds, the picture fades in, and it is looked at
 * for a moment before anyone speaks. The fades themselves are in story.css.
 */
const ART_HOLD_MS = 700;
const ART_IN_MS = 1300;
const ART_BEAT_MS = 450;
const ART_OUT_MS = 1000;

/**
 * Plays an act inside `screen` (the element holding `storyMarkup`) and returns the function that
 * stops it. An act that is not built yet falls back to the first one. This is the stage: the text
 * box, the chips, the keys and the save. What happens on it is up to the scene's player.
 */
export function mountStory(
  screen: HTMLElement,
  host: StoryHost,
  actId?: string,
  titled = false,
): StoryHandle {
  let act = ACTS.find((candidate) => candidate.id === actId && candidate.scene) ?? ACTS[0];
  const find = <T extends HTMLElement>(selector: string) => screen.querySelector<T>(selector)!;
  const root = find(".story-stage"),
    goal = find(".story-goal"),
    prompt = find(".story-prompt"),
    card = find(".story-card"),
    saved = find(".story-save"),
    title = find(".story-title"),
    art = find<HTMLImageElement>(".stage-art");
  const dialogue = new DialogueBox(
    root,
    { zero: ZERO_PORTRAITS, lulu: LULU_PORTRAITS, zhangsan: ZHANGSAN_PORTRAITS },
    { tick: () => host.typeTick(), move: () => host.menu("click"), accept: () => host.menu("accept") },
  );
  const flags: Record<string, number> = {};
  const held = new Set<string>();
  const timers = new Set<number>();
  /** Empty while the scene is being created: a scene starts talking before it exists here. */
  const running: { player?: ScenePlayer } = {};
  let alive = true,
    ended = false,
    paused = false;
  /** Set while an act's scene is being created: its opening picture is there from the first frame. */
  let opening = false;
  /** The picture's last change, which a conversation waits out, and a count that outdates old ones. */
  let artSettled: Promise<boolean> = Promise.resolve(true),
    artTurn = 0;
  /** The picture being dissolved out of, under the one coming in. */
  let ghost: HTMLImageElement | undefined;
  const dropGhost = () => {
    ghost?.remove();
    ghost = undefined;
  };

  const stage: Stage = {
    root,
    get canvas() {
      return find<HTMLCanvasElement>(".story-canvas");
    },
    host,
    async talk(lines, { live = false } = {}) {
      if (!live && running.player) running.player.frozen = true;
      if (!live) prompt.hidden = true;
      if (!(await artSettled)) return false;
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
      if (text && goal.textContent !== `目标：${text}`) goal.textContent = `目标：${text}`;
    },
    prompt(text) {
      prompt.hidden = !text;
      if (text) prompt.lastElementChild!.textContent = text;
    },
    art(url, { cut = false } = {}) {
      const turn = ++artTurn;
      if (!url) {
        if (!art.hidden) {
          art.classList.remove("entering");
          art.classList.add("leaving");
          void stage.wait(ART_OUT_MS).then((ok) => {
            if (!ok || turn !== artTurn) return;
            art.hidden = true;
            art.classList.remove("leaving");
          });
        }
        return (artSettled = Promise.resolve(alive));
      }
      unlockIllustration(url);
      const shown = !art.hidden;
      dropGhost();
      art.classList.remove("entering", "leaving");
      if (cut || opening) {
        art.src = url;
        art.hidden = false;
        return (artSettled = Promise.resolve(alive));
      }
      // Over another picture there is nothing to hold on: the old one stays under the new.
      if (shown) {
        ghost = art.cloneNode() as HTMLImageElement;
        art.before(ghost);
      }
      const hold = shown ? 0 : ART_HOLD_MS;
      art.src = url;
      art.hidden = false;
      art.style.setProperty("--art-hold", `${hold}ms`);
      art.style.setProperty("--art-in", `${ART_IN_MS}ms`);
      // Restart the fade if the last one is still running.
      void art.offsetWidth;
      art.classList.add("entering");
      return (artSettled = stage.wait(hold + ART_IN_MS + ART_BEAT_MS).then((ok) => {
        if (turn === artTurn) {
          dropGhost();
          art.classList.remove("entering");
        }
        return ok;
      }));
    },
    overlay() {
      const canvas = document.createElement("canvas");
      canvas.className = "story-cutscene";
      art.before(canvas);
      return canvas;
    },
    mark(checkpoint) {
      reachCheckpoint(checkpoint, flags);
      saved.hidden = true;
      // Restart the mark's own fade if the last one is still up.
      void saved.offsetWidth;
      saved.hidden = false;
      void stage.wait(SAVE_NOTE_MS).then(() => (saved.hidden = true));
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
    delete root.dataset.tutorial;
    root.classList.remove("booting", "blackout", "pulling", "veiled");
    artTurn++;
    artSettled = Promise.resolve(true);
    dropGhost();
    art.hidden = true;
    art.classList.remove("entering", "leaving");
    const canvas = document.createElement("canvas");
    canvas.className = "story-canvas";
    stage.canvas.replaceWith(canvas);
    // The scene starts out frozen, and its first conversation releases it.
    running.player = undefined;
    opening = true;
    running.player =
      scene.kind === "room"
        ? (scene.play?.(stage) ?? playRoom(stage, scene))
        : scene.kind === "arcade"
          ? playArcade(stage, scene)
          : scene.play(stage);
    opening = false;
    running.player.paused = paused;
    steer();
  };
  /** One act runs into the next behind a short fade, with no stop at the menu. */
  const handOver = async (next: (typeof ACTS)[number]) => {
    root.classList.add("switching");
    if (!(await stage.wait(SWITCH_MS / 2))) return;
    running.player?.dispose();
    act = next;
    open();
    await running.player?.ready;
    if (!alive) return;
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
    if (paused) return;
    // Shop buttons keep their native keyboard activation while the story waits for deployment.
    if (event.target instanceof HTMLElement && event.target.closest(".shop-modal")) return;
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
    if (paused) return;
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
    await running.player?.ready;
    if (!alive) return;
    title.classList.add("leaving");
    if (await stage.wait(700)) title.hidden = true;
  };
  if (titled) void announce();
  else open();
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  root.addEventListener("click", onClick);

  return {
    get actId() {
      return act.id;
    },
    pause(on) {
      paused = on;
      if (running.player) running.player.paused = on;
      if (on) onBlur();
    },
    stop() {
      alive = false;
      for (const timer of timers) clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      dialogue.dispose();
      running.player?.dispose();
    },
  };
}
