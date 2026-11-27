import "./story.css";
import { ZERO_PORTRAITS } from "./assets";
import { ACTS } from "./chapters";
import { DialogueBox, dialogueMarkup } from "./dialogue";
import { openRoom } from "./room";
import { reachCheckpoint } from "./save";
import type { Hotspot } from "./script";

/** What the story needs from the app around it. */
export interface StoryHost {
  typeTick(): void;
  menu(name: "click" | "accept"): void;
  /** The scene is over and its checkpoint saved: return to the menu. */
  finish(): void;
}

export const storyMarkup = () => `
  <div class="story-stage">
    <canvas class="story-canvas"></canvas>
    <img class="story-art" alt="" hidden />
    <div class="story-goal" hidden></div>
    <div class="story-prompt" hidden><kbd>E</kbd><span></span></div>
    ${dialogueMarkup}
    <div class="story-card" hidden><h2></h2><p></p><small>按 E 返回主菜单</small></div>
    <div class="story-keys"><span><kbd>WASD</kbd> 移动</span><span><kbd>E</kbd> 调查 / 继续</span><span><kbd>ESC</kbd> 离开</span></div>
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

/**
 * Plays an act inside `screen` (the element holding `storyMarkup`) and returns the function that
 * stops it. An act that is not built yet falls back to the first one. The room, the text box and the keys live here; the app only supplies sound and the
 * way back to the menu.
 */
export function mountStory(screen: HTMLElement, host: StoryHost, actId?: string): () => void {
  const scene = (ACTS.find((act) => act.id === actId && act.scene) ?? ACTS[0]).scene!;
  const find = <T extends HTMLElement>(selector: string) => screen.querySelector<T>(selector)!;
  const stage = find(".story-stage"),
    goal = find(".story-goal"),
    prompt = find(".story-prompt"),
    card = find(".story-card"),
    art = find<HTMLImageElement>(".story-art");
  const dialogue = new DialogueBox(
    stage,
    { zero: ZERO_PORTRAITS },
    { tick: () => host.typeTick(), move: () => host.menu("click"), accept: () => host.menu("accept") },
  );
  /** How many times each cycling hotspot has been examined. */
  const visits = new Map<string, number>();
  const current = (hotspot: Hotspot) =>
    hotspot.cycle ? hotspot.cycle[(visits.get(hotspot.id) ?? 0) % hotspot.cycle.length] : hotspot;
  const showPrompt = (hotspot: Hotspot | undefined) => {
    prompt.hidden = !hotspot || room.frozen;
    if (hotspot) prompt.lastElementChild!.textContent = current(hotspot).label;
  };
  const room = openRoom(find<HTMLCanvasElement>(".story-canvas"), scene, (hotspot) => showPrompt(hotspot));
  const flags: Record<string, number> = {};
  const held = new Set<string>();
  let alive = true,
    ended = false;

  const steer = () => {
    let x = 0,
      y = 0;
    for (const code of held) {
      x += MOVES[code][0];
      y += MOVES[code][1];
    }
    room.move(Math.sign(x), Math.sign(y));
  };
  /** Runs a conversation with the player held still. Resolves false if the story was closed meanwhile. */
  const talk = async (lines: Parameters<DialogueBox["play"]>[0]) => {
    room.frozen = true;
    prompt.hidden = true;
    Object.assign(flags, await dialogue.play(lines));
    return alive;
  };
  const release = () => {
    room.frozen = false;
    showPrompt(room.facing);
  };
  const examine = async (hotspot: Hotspot) => {
    const { lines } = current(hotspot);
    visits.set(hotspot.id, (visits.get(hotspot.id) ?? 0) + 1);
    if (!(await talk(lines))) return;
    if (!hotspot.ends) return release();
    goal.hidden = true;
    stage.classList.add("booting");
    if (!(await talk(scene.outro))) return;
    reachCheckpoint(scene.checkpoint, flags);
    card.querySelector("h2")!.textContent = scene.endCard.title;
    card.querySelector("p")!.textContent = scene.endCard.note;
    card.hidden = false;
    ended = true;
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
    else if (room.facing) void examine(room.facing);
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
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  stage.addEventListener("click", onClick);

  const begin = async () => {
    if (scene.opening) {
      art.src = scene.opening.art;
      art.hidden = false;
      if (!(await talk(scene.opening.lines))) return;
      art.classList.add("leaving");
      art.addEventListener("animationend", () => (art.hidden = true), { once: true });
    }
    if (!(await talk(scene.intro))) return;
    goal.textContent = `目标：${scene.goal}`;
    goal.hidden = false;
    release();
  };
  void begin();

  return () => {
    alive = false;
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
    dialogue.dispose();
    room.dispose();
  };
}
