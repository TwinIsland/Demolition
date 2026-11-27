import "./bedroom.css";
import { STORY_ART } from "./assets";
import { playComputerApproach } from "./cutscenes/computer-approach";
import type { Cutscene } from "./cutscenes/kit";
import { openRoom } from "./room";
import type { Hotspot, Line, RoomScene } from "./script";
import type { ScenePlayer, Stage } from "./stage";

type Phase = "find" | "carry" | "plug" | "boot";

/** Pick up the computer, place it on the desk, then power it before entering Bubble X. */
export function playBedroom(stage: Stage, scene: RoomScene): ScenePlayer {
  let phase: Phase = "find",
    alive = true,
    busy = true,
    paused = false;
  let film: Cutscene | undefined;
  const visits = new Map<string, number>();
  const furniture = document.createElement("div");
  furniture.className = "bedroom-furniture";
  furniture.innerHTML = `<div class="bedroom-computer" hidden></div>
    <aside class="story-inventory" hidden role="status"><small>物品栏</small><span><img src="${STORY_ART.computerItem}" alt=""><b>旧电脑 ×1</b></span></aside>`;
  stage.root.querySelector(".story-dialogue")!.before(furniture);
  const computer = furniture.querySelector<HTMLElement>(".bedroom-computer")!;
  computer.style.backgroundImage = `url("${STORY_ART.computer}")`;
  const inventory = furniture.querySelector<HTMLElement>(".story-inventory")!;
  const current = (hotspot: Hotspot) =>
    hotspot.cycle ? hotspot.cycle[(visits.get(hotspot.id) ?? 0) % hotspot.cycle.length] : hotspot;
  const label = (hotspot: Hotspot) => {
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
        : phase === "carry"
          ? "电脑已放入物品栏；走到书桌旁按 E 摆放"
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
          if (!(await talk(hotspot.lines))) return;
          if (!alive) return;
          phase = "carry";
          inventory.hidden = false;
          guide();
          stage.host.cue("pickup");
          if (
            !(await talk([
              { who: "system", text: "获得「旧电脑」。已放入右下角物品栏。到书桌旁按 E，就能把它摆上去。" },
            ]))
          )
            return;
        } else if (!(await talk([{ who: "narrator", text: "床底只剩下一个空纸箱。电脑已经拿出来了。" }])))
          return;
      } else if (hotspot.id === "desk" && phase === "carry") {
        phase = "plug";
        computer.hidden = false;
        inventory.hidden = true;
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
          computer.classList.add("powered");
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
          film = playComputerApproach(stage.overlay());
          film.paused = paused;
          await film.done;
          if (alive) stage.end(scene.checkpoint);
        }
      } else if (hotspot.id === "desk" && phase === "plug") {
        if (!(await talk([{ who: "narrator", text: "电脑已经摆好。屏幕还是黑的，去桌子下方打开插线板。" }])))
          return;
      } else {
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
      stage.art(scene.opening.art);
      if (!(await talk(scene.opening.lines))) return;
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
