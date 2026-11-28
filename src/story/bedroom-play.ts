import "./bedroom.css";
import { COMPUTER_ON } from "./acts/home-map";
import { RPG_ART, STORY_ART } from "./assets";
import { playComputerApproach } from "./cutscenes/computer-approach";
import { playStare } from "./cutscenes/stare";
import { playWindow } from "./cutscenes/window";
import type { Cutscene } from "./cutscenes/kit";
import { openRoom } from "./room";
import type { Hotspot, Line, RoomScene } from "./script";
import { seeFilm } from "./films";
import type { ScenePlayer, Stage } from "./stage";
import { t } from "../i18n";

/**
 * The errand, in order: `find` the box under the bed; it is `locked`; with the `key` from under
 * the figurine it opens; `carry` the computer to the desk; `plug` it in; it `boot`s.
 */
type Phase = "find" | "locked" | "key" | "carry" | "plug" | "boot";

/**
 * Act 1's errand through the bedroom and the bathroom. Every step is something in the rooms: the
 * key is under the figurine, the box under the bed, the socket under the desk.
 */
export function playBedroom(stage: Stage, scene: RoomScene): ScenePlayer {
  let phase: Phase = "find",
    alive = true,
    busy = true,
    paused = false;
  let film: Cutscene | undefined;
  const visits = new Map<string, number>();
  const furniture = document.createElement("div");
  furniture.className = "bedroom-furniture";
  furniture.innerHTML = `<aside class="story-inventory" hidden role="status"><small>${t("物品栏")}</small>
    <span data-item="key" hidden><img src="${RPG_ART.key}" alt=""><b>${t("铁盒钥匙")} ×1</b></span>
    <span data-item="computer" hidden><img src="${STORY_ART.computerItem}" alt=""><b>${t("旧电脑")} ×1</b></span></aside>`;
  stage.root.querySelector(".story-dialogue")!.before(furniture);
  const inventory = furniture.querySelector<HTMLElement>(".story-inventory")!;
  /** What he carries; nothing hides the panel. */
  const carry = (item?: "key" | "computer") => {
    inventory.hidden = !item;
    for (const slot of inventory.querySelectorAll<HTMLElement>("[data-item]"))
      slot.hidden = slot.dataset.item !== item;
  };
  const current = (hotspot: Hotspot) =>
    hotspot.cycle ? hotspot.cycle[(visits.get(hotspot.id) ?? 0) % hotspot.cycle.length] : hotspot;
  const label = (hotspot: Hotspot) => {
    if (hotspot.id === "under-bed")
      return phase === "find"
        ? "床底"
        : phase === "locked"
          ? "上锁的铁盒"
          : phase === "key"
            ? "用钥匙打开铁盒"
            : "空铁盒";
    if (hotspot.id === "desk" && phase === "carry") return "把物品栏里的电脑摆上桌";
    if (hotspot.id === "power-strip") return phase === "plug" ? "插上电脑电源，打开插线板" : "插线板";
    if (hotspot.id === "desk" && phase === "plug") return "未通电的电脑";
    return current(hotspot).label;
  };
  const prompt = () =>
    stage.prompt(play.facing && !play.frozen && !busy && phase !== "boot" ? label(play.facing) : undefined);
  const play = openRoom(stage.canvas, scene, prompt);
  const guide = () => {
    stage.goal(
      phase === "find"
        ? "走到床尾，按 E 调查床底"
        : phase === "locked"
          ? "铁盒上了锁；在家里找到钥匙"
          : phase === "key"
            ? "带着钥匙回到床尾，按 E 打开铁盒"
            : phase === "carry"
              ? "走到书桌旁，按 E 摆放电脑"
              : "找到桌子下方的插线板，按 E 接通电脑电源",
    );
    prompt();
  };
  const talk = (lines: readonly Line[]) => stage.talk(lines);
  const examine = async (hotspot: Hotspot) => {
    if (busy || play.frozen || phase === "boot") return;
    busy = true;
    play.frozen = true;
    stage.prompt();
    try {
      if (hotspot.id === "under-bed") {
        if (phase === "find") {
          phase = "locked";
          guide();
          if (
            !(await talk([
              { who: "zero", mood: "sincere", text: "床底……有一只上了锁的铁盒。里面封印着什么。" },
              { who: "narrator", text: "他自己锁的。钥匙放在哪，他自己忘了。" },
              { who: "zero", mood: "flustered", text: "……是封印太强，连吾的记忆都被夺走了。" },
            ]))
          )
            return;
        } else if (phase === "locked") {
          if (!(await talk([{ who: "narrator", text: "锁着。钥匙不在卧室里：卧室他已经翻过三遍了。" }])))
            return;
        } else if (phase === "key") {
          play.set("lockbox", { hidden: true });
          play.set("lockbox-open", { hidden: false });
          stage.host.menu("accept");
          if (!(await talk([{ who: "narrator", text: "钥匙转了半圈。「咔」。" }, ...hotspot.lines]))) return;
          if (!alive) return;
          phase = "carry";
          carry("computer");
          guide();
          stage.host.cue("pickup");
          if (!(await talk([{ who: "system", text: "获得「旧电脑」。到书桌旁按 E 摆上去。" }]))) return;
        } else if (!(await talk([{ who: "narrator", text: "床底只剩下一只空铁盒。电脑已经拿出来了。" }])))
          return;
      } else if (hotspot.id === "figurine") {
        if (phase === "find" || phase === "locked") {
          if (!(await talk(hotspot.lines))) return;
          if (!alive) return;
          const sought = phase === "locked";
          phase = "key";
          play.set("figurine-glint", { hidden: true });
          carry("key");
          guide();
          stage.host.cue("pickup");
          if (
            !(await talk([
              { who: "narrator", text: "底座下面，用胶带粘着一把小钥匙。" },
              sought
                ? { who: "zero", mood: "smug", text: "……想起来了。最安全的地方，就是最不洁之地。" }
                : { who: "zero", mood: "flustered", text: "……这是哪里的钥匙来着。" },
              { who: "system", text: "获得「铁盒钥匙」。" },
            ]))
          )
            return;
        } else if (
          !(await talk([
            { who: "zero", mood: "sincere", text: "守护的使命已经完成。辛苦了。" },
            { who: "narrator", text: "手办没有回答。它的底座现在有点粘。" },
          ]))
        )
          return;
      } else if (hotspot.id === "desk" && phase === "carry") {
        phase = "plug";
        play.set("computer", { hidden: false, frame: 0 });
        carry();
        guide();
        stage.host.menu("accept");
        if (
          !(await talk([
            { who: "narrator", text: "他把旧电脑摆在空着的桌面上，屏幕对着椅子。" },
            { who: "zero", mood: "smug", text: "魔导器已归位。接下来——" },
            { who: "narrator", text: "没通电。插线板在桌子下面，开关还关着。" },
          ]))
        )
          return;
      } else if (hotspot.id === "power-strip") {
        if (phase !== "plug") {
          if (!(await talk([{ who: "narrator", text: "插线板有空插口。先把床底那台旧电脑搬到桌上吧。" }])))
            return;
        } else {
          phase = "boot";
          stage.goal();
          play.set("computer", { loop: COMPUTER_ON });
          play.set("strip-light", { hidden: false });
          stage.host.cue("power");
          if (
            !(await talk([
              { who: "narrator", text: "插头接好，开关「咔哒」一声。屏幕亮了。" },
              ...scene.outro,
            ]))
          )
            return;
          if (!alive) return;
          stage.goal();
          stage.prompt();
          stage.root.classList.add("bedroom-cinematic");
          seeFilm("computer");
          film = playComputerApproach(stage.overlay());
          film.paused = paused;
          await film.done;
          if (alive) stage.end(scene.checkpoint);
        }
      } else if (hotspot.id === "desk" && phase === "plug") {
        if (!(await talk([{ who: "narrator", text: "电脑已经摆好。屏幕还是黑的，去桌子下方打开插线板。" }])))
          return;
      } else {
        if (hotspot.id === "cirno" && !visits.has(hotspot.id)) {
          // The first look at the plush is returned.
          stage.root.classList.add("bedroom-cinematic");
          seeFilm("stare");
          const stare = (film = playStare(stage.overlay()));
          stare.paused = paused;
          await stare.done;
          stare.dispose();
          film = undefined;
          stage.root.classList.remove("bedroom-cinematic");
          if (!alive) return;
        }
        const content = current(hotspot);
        visits.set(hotspot.id, (visits.get(hotspot.id) ?? 0) + 1);
        if (!(await talk(content.lines))) return;
      }
    } finally {
      busy = false;
      if (alive && phase !== "boot") {
        play.frozen = false;
        guide();
      }
    }
  };
  const begin = async () => {
    if (scene.opening) {
      // The narrator speaks over the block seen from the street; the picture of him comes after.
      const { art, lines, over = 0 } = scene.opening;
      seeFilm("window-dusk");
      const evening = (film = playWindow(stage.overlay(), "dusk"));
      evening.paused = paused;
      const began = performance.now();
      if (!(await stage.wait(2400))) return;
      if (over && !(await talk(lines.slice(0, over)))) return;
      // However fast the lines were read, the camera gets most of its way to the window.
      if (!(await stage.wait(Math.max(0, 8000 - (performance.now() - began)))) || !alive) return;
      // The film leaves only once the picture covers it.
      if (!(await stage.art(art))) return;
      evening.dispose();
      film = undefined;
      if (!(await talk(lines.slice(over)))) return;
      stage.art();
    }
    if (!(await talk(scene.intro)) || !alive) return;
    busy = false;
    play.frozen = false;
    guide();
  };
  void begin();
  return {
    move: (x, y) => play.move(x, y),
    act: () => {
      if (play.facing) void examine(play.facing);
    },
    get frozen() {
      return play.frozen;
    },
    set frozen(value) {
      play.frozen = value || busy || phase === "boot";
    },
    get paused() {
      return paused;
    },
    set paused(value) {
      paused = value;
      play.paused = value;
      furniture.classList.toggle("paused", value);
      if (film) film.paused = value;
    },
    dispose() {
      alive = false;
      film?.dispose();
      play.dispose();
      furniture.remove();
      stage.root.classList.remove("bedroom-cinematic");
    },
  };
}
