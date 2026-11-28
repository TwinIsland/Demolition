import { BEDROOM } from "./acts/bedroom";
import { BUBBLE_X } from "./acts/bubble-x";
import { FLATLAND_LINES } from "./acts/flatland";
import { ASCENSION_LINES } from "./acts/ascension";
import { SHUTDOWN_SCRIPT } from "./acts/shutdown";
import { ASCENSION_ART } from "./ascend/assets";
import { playAscension } from "./ascend/play";
import { STORY_ART, STORY_SKINS } from "./assets";
import { playComputerApproach } from "./cutscenes/computer-approach";
import { playEvening, type EveningShot } from "./cutscenes/evening";
import { playFarewell, type FarewellShot } from "./cutscenes/farewell";
import { playIntroCard } from "./cutscenes/intro-card";
import { playLanding } from "./cutscenes/landing";
import { playRelicDrop } from "./cutscenes/relic-drop";
import { playStare } from "./cutscenes/stare";
import { playStatusQueue } from "./cutscenes/status-queue";
import { playWindow } from "./cutscenes/window";
import type { FilmId } from "./films";
import { playPullIn } from "./pull-in";
import type { Line } from "./script";
import { playApocalypse } from "./shutdown/apocalypse";
import { playPullOut } from "./shutdown/pull-out";
import type { ScenePlayer, Stage } from "./stage";

/** A film as the reel holds it: every kind of cutscene the story has fits. */
interface Showing {
  readonly done: Promise<void>;
  paused?: boolean;
  dispose(): void;
}

/** What a replay is given to work with, besides the stage. */
interface Reel {
  readonly stage: Stage;
  /** Puts a film up: it pauses and closes with the replay. `held` keeps it on its first frame. */
  show<T extends Showing>(film: T, held?: boolean): T;
  /** Lets a held film run. */
  roll(film: Showing): void;
  drop(film: Showing): void;
  /** Covers a change with a dip to black. */
  fade(change: () => void): Promise<boolean>;
}

/** A replay resolves false when the story was closed under it. */
type Script = (reel: Reel) => Promise<boolean>;

const FADE_MS = 450;
/** How long the last picture stands before the replay closes. */
const LAST_MS = 900;

/**
 * Plays a film from the collection: `script` puts the films up and reads the lines round them,
 * the way the act does, and the replay returns to the menu when it is through.
 */
function reel(stage: Stage, script: Script): ScenePlayer {
  const films = new Map<Showing, boolean>();
  let paused = false,
    disposed = false;
  const sync = () => {
    for (const [film, held] of films) film.paused = paused || held;
  };
  const tools: Reel = {
    stage,
    show(film, held = false) {
      films.set(film, held);
      sync();
      return film;
    },
    roll(film) {
      if (films.has(film)) films.set(film, false);
      sync();
    },
    drop(film) {
      films.delete(film);
      film.dispose();
    },
    async fade(change) {
      stage.root.classList.add("switching");
      if (!(await stage.wait(FADE_MS))) return false;
      change();
      if (!(await stage.wait(FADE_MS))) return false;
      stage.root.classList.remove("switching");
      return true;
    },
  };
  const close = async (played: boolean) => {
    if (!played || disposed) return;
    if (!(await stage.wait(LAST_MS))) return;
    stage.root.classList.add("switching");
    if (await stage.wait(FADE_MS)) stage.host.finish();
  };
  void script(tools).then(close, (error) => {
    // A film that throws must not leave the player in front of a frozen picture.
    console.error(error);
    if (!disposed) stage.host.finish();
  });
  return {
    frozen: true,
    get paused() {
      return paused;
    },
    set paused(value) {
      paused = value;
      sync();
    },
    move: () => {},
    act: () => {},
    dispose() {
      disposed = true;
      for (const film of films.keys()) film.dispose();
      films.clear();
    },
  };
}

const shutdown = SHUTDOWN_SCRIPT.lines;
const cirno = BEDROOM.hotspots.find((hotspot) => hotspot.id === "cirno");

const SCRIPTS: Record<Exclude<FilmId, "ascension">, Script> = {
  // Act 1: the block from the street under the narrator, then the picture of him.
  "window-dusk": async ({ stage, show, drop }) => {
    const { art, lines, over = 0 } = BEDROOM.opening!;
    stage.host.music("opening");
    const film = show(playWindow(stage.overlay(), "dusk"));
    const began = performance.now();
    if (!(await stage.wait(2400))) return false;
    if (over && !(await stage.talk(lines.slice(0, over)))) return false;
    if (!(await stage.wait(Math.max(0, 8000 - (performance.now() - began))))) return false;
    if (!(await stage.art(art))) return false;
    drop(film);
    if (!(await stage.talk(lines.slice(over)))) return false;
    stage.art();
    return true;
  },
  stare: async ({ stage, show }) => {
    stage.host.music("opening");
    await show(playStare(stage.overlay())).done;
    return stage.talk(cirno?.lines ?? []);
  },
  // The lines are read over the room as the film first shows it, and then it moves.
  computer: async ({ stage, show, roll }) => {
    stage.host.music("opening");
    const film = show(playComputerApproach(stage.overlay()), true);
    if (!(await stage.talk(BEDROOM.outro))) return false;
    roll(film);
    await film.done;
    return true;
  },
  // Act 2: the power is out, and only the screen is lit.
  "pull-in": async ({ stage, show, drop }) => {
    const { lines, goneArt } = BUBBLE_X;
    stage.host.silence();
    if (!(await stage.wait(600))) return false;
    if (!(await stage.talk([...lines.blackout, ...lines.pulled]))) return false;
    stage.host.cue("pull");
    const film = show(playPullIn(stage.overlay()));
    await film.done;
    if (!(await stage.art(goneArt))) return false;
    drop(film);
    if (!(await stage.talk(lines.gone))) return false;
    stage.art();
    return true;
  },
  // Act 3.
  landing: async ({ stage, show, drop }) => {
    stage.host.music("opening");
    const film = show(playLanding(stage.overlay()));
    await film.done;
    if (!(await stage.art(STORY_ART.comic3))) return false;
    drop(film);
    if (!(await stage.talk(FLATLAND_LINES.arrive))) return false;
    stage.art();
    return true;
  },
  "lulu-card": async ({ stage, show }) => {
    stage.host.music("opening");
    if (!(await stage.wait(600))) return false;
    if (!(await stage.talk(FLATLAND_LINES.wake))) return false;
    const card = playIntroCard(stage.overlay(), {
      skin: STORY_SKINS["story-lulu"],
      title: "露露",
      note: "新手引导精灵 · 16×16",
      tint: "#ff7a9a",
    });
    await show(card).done;
    return stage.talk(FLATLAND_LINES.meet);
  },
  "rival-card": async ({ stage, show }) => {
    stage.host.music("opening");
    if (!(await stage.wait(600))) return false;
    if (!(await stage.talk(FLATLAND_LINES.duelCall))) return false;
    const card = playIntroCard(stage.overlay(), {
      skin: STORY_SKINS["story-zhangsan"],
      title: "【对手名称】",
      note: "示例对手 · 【在此填写简介】",
      tint: "#9aa3b5",
    });
    await show(card).done;
    return stage.talk(FLATLAND_LINES.duelIntro);
  },
  relic: async ({ stage, show, drop }) => {
    stage.host.silence();
    if (!(await stage.wait(1200))) return false;
    if (!(await stage.talk(FLATLAND_LINES.defeat))) return false;
    const film = show(playRelicDrop(stage.overlay(), (name) => stage.host.cue(name)));
    await film.done;
    if (!(await stage.art(STORY_ART.comic3b))) return false;
    drop(film);
    stage.host.music("opening");
    if (!(await stage.talk(FLATLAND_LINES.relic))) return false;
    if (!(await stage.talk(FLATLAND_LINES.press))) return false;
    stage.art();
    return true;
  },
  // Act 4: the question at the graves, and what answers it.
  "status-queue": async ({ stage, show }) => {
    const said: readonly Line[] = ASCENSION_LINES.risen;
    stage.host.silence();
    if (!(await stage.art(ASCENSION_ART.risen))) return false;
    if (!(await stage.talk(said.slice(0, 5)))) return false;
    stage.art();
    if (!(await stage.wait(700))) return false;
    await show(playStatusQueue(stage.overlay())).done;
    if (!(await stage.wait(600))) return false;
    return stage.talk(said.slice(5));
  },
  // Act 5: the last of the three gets up again.
  "final-form": async ({ stage, show }) => {
    const last = SHUTDOWN_SCRIPT.kings[SHUTDOWN_SCRIPT.kings.length - 1];
    stage.host.silence();
    if (!(await stage.wait(1100))) return false;
    if (!(await stage.talk(shutdown.rise))) return false;
    stage.host.cue("power");
    await show(playApocalypse(stage.overlay(), last.color)).done;
    stage.host.cue("blast");
    stage.host.music("shutdown");
    return stage.talk(
      shutdown.risen.map((line) => ({ ...line, text: line.text.replace("{name}", last.name) })),
    );
  },
  farewell: async ({ stage, show, fade }) => {
    const said = shutdown.farewell;
    stage.host.silence();
    let scene!: ReturnType<typeof playFarewell>;
    if (!(await fade(() => (scene = show(playFarewell(stage.overlay())))))) return false;
    if (!(await stage.wait(2200)) || !(await stage.talk(shutdown.won))) return false;
    const shown = async (cut: FarewellShot, words: readonly Line[], before = () => {}) =>
      (await fade(() => (before(), scene.cut(cut)))) && (await stage.wait(1800)) && (await stage.talk(words));
    stage.host.music("farewell");
    if (!(await shown("sky", said.sky)) || !(await shown("island", said.village))) return false;
    if (!(await shown("ribbon", said.ribbon))) return false;
    return shown("faces", said.end, () => scene.percent(98));
  },
  // The "go back" ending: out of the screen, and the block in the morning.
  "pull-out": async ({ stage, show }) => {
    stage.host.music("farewell");
    if (!(await stage.wait(600))) return false;
    if (!(await stage.talk(shutdown.home.parting))) return false;
    const out = show(playPullOut(stage.overlay()));
    stage.host.cue("power");
    if (!(await stage.wait(5200))) return false;
    stage.host.music("home");
    await out.done;
    return true;
  },
  "window-morning": async ({ stage, show, fade }) => {
    stage.host.music("home");
    let morning!: ReturnType<typeof playWindow>;
    if (!(await fade(() => (morning = show(playWindow(stage.overlay(), "morning")))))) return false;
    if (!(await stage.wait(3600))) return false;
    if (!(await stage.talk(shutdown.home.table.slice(-1)))) return false;
    await morning.done;
    return true;
  },
  // The "stay" ending: the road at sunset, then supper.
  evening: async ({ stage, show, fade }) => {
    const { road, away, table, toast } = shutdown.stay.evening;
    stage.host.music("farewell");
    if (!(await stage.wait(600))) return false;
    if (!(await stage.talk(shutdown.stay.parting))) return false;
    let evening!: ReturnType<typeof playEvening>;
    stage.host.music("opening");
    if (!(await fade(() => (evening = show(playEvening(stage.overlay())))))) return false;
    if (!(await stage.wait(4800)) || !(await stage.talk(road))) return false;
    const cut = (shot: EveningShot) => fade(() => evening.cut(shot));
    if (!(await cut("away")) || !(await stage.wait(2600))) return false;
    if (!(await stage.talk(away)) || !(await stage.wait(1200))) return false;
    if (!(await cut("table")) || !(await stage.wait(2800))) return false;
    if (!(await stage.talk(table))) return false;
    evening.cheers();
    return (await stage.wait(2400)) && (await stage.talk(toast)) && (await stage.wait(3200));
  },
};

/** How the stage is dressed for a film, and the player that shows it. */
export function playReplay(id: FilmId): { kind: "film" | "staged"; play(stage: Stage): ScenePlayer } {
  // The ascension is a shot of the real match, so the act itself plays it and stops after it.
  // The act's opening music is still playing when the device goes off.
  if (id === "ascension")
    return { kind: "staged", play: (stage) => (stage.host.music("opening"), playAscension(stage, true)) };
  return { kind: "film", play: (stage) => reel(stage, SCRIPTS[id]) };
}
