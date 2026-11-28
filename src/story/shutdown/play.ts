import "./shutdown.css";
import { BotAgent } from "../../agents/bot-agent";
import { SKILLS } from "../../core/content";
import type { GameSnapshot, StoryActor, Vec2 } from "../../core/types";
import type { HomeRoom, SHUTDOWN_SCRIPT } from "../acts/shutdown";
import type { Director } from "../match/director";
import { playStagedMatch } from "../match/staged-match";
import { hasCheckpoint, loadStory } from "../save";
import type { Line } from "../script";
import type { ScenePlayer, Stage, StoryMatchOptions } from "../stage";
import { SHUTDOWN_ART } from "./art";
import { playChoice } from "./choice";
import { rollCredits } from "./credits";
import type { Cutscene } from "../cutscenes/kit";
import { playWindow } from "../cutscenes/window";
import { walkRoom } from "./home";
import { sayTooMuch } from "./overflow";
import { playPullOut } from "./pull-out";
import { ArrivalShaft } from "./arrival";
import { ShutdownSky } from "./sky";
import { playStroll, STROLL } from "./stroll";
import { reachEnding, type Ending } from "./unlocks";

type Script = typeof SHUTDOWN_SCRIPT;
/** Whatever is on stage at the moment: a staged match, a film, a room, the credits. */
interface Part {
  frozen?: boolean;
  paused: boolean;
  move?(x: number, y: number): void;
  act?(): void;
  dispose(): void;
}

const MAP = "flatland-story";
const HERO_SKIN = "story-zero";
/** What the hero carries into the last fight: a little of everything act 4 taught. */
const KIT = { bandage: 2, grenade: 2, molotov: 1, shield: 1 } as const;
const COINS = 8;
/** Height the three wait at, out of sight, and the height they are let go from. */
const PARKED = 300,
  DROP = 16;
const FADE_MS = 450;
/** Easier opponents after this many defeats: the story should end, sooner or later. */
const MERCY_AFTER = 2;
const SOUTH = 0,
  EAST = Math.PI / 2,
  NORTH = Math.PI;
/** Whoever comes next wears the game's own default; only their hand is ever seen. */
const NEWCOMER_SKIN = "sapper";
/** The newcomer's way down: from how high, and for how long. */
const ARRIVAL = { height: 46, ms: 4200 };

/**
 * Plays act 5 from the voice in the sky to the credits. It is a chain of parts, each of which
 * owns the stage for a while: a calm match for the opening, the real one for the fight (again
 * after every defeat), the choice, and then one of two endings. The stage talks to whichever
 * part is up through the one player this returns.
 */
export function playShutdown(
  stage: Stage,
  script: Script,
  rooms: { bedroom: HomeRoom; dining: HomeRoom },
): ScenePlayer {
  const { lines, spots, kings, goals, checkpoints } = script;
  const parts = new Set<Part>();
  /** The part the keys and the stage's freezing go to. */
  let front: Part | undefined;
  let frozen = true,
    paused = false,
    /** Holds the match still under a film laid over it. */
    held = false,
    disposed = false;
  const sync = () => {
    for (const part of parts) part.paused = paused || (held && part !== front);
  };
  const enter = <T extends Part>(part: T, leading = true): T => {
    parts.add(part);
    if (leading) {
      front = part;
      if (part.frozen !== undefined) part.frozen = frozen;
    }
    sync();
    return part;
  };
  const leave = (part: Part | undefined) => {
    if (!part) return;
    parts.delete(part);
    if (front === part) front = undefined;
    part.dispose();
  };
  const fade = async (change: () => void) => {
    stage.root.classList.add("switching");
    if (!(await stage.wait(FADE_MS))) return false;
    change();
    if (!(await stage.wait(FADE_MS))) return false;
    stage.root.classList.remove("switching");
    return true;
  };
  /** A slice of a conversation read over an illustration, if the illustration has been painted. */
  const over = async (art: string | undefined, said: readonly Line[]) => {
    if (art) stage.art(art);
    const alive = await stage.talk(said);
    if (art && alive) stage.art();
    return alive;
  };

  /** Runs `scene` on a staged match and resolves with what it returns, or undefined once closed. */
  const staged = <T>(
    options: StoryMatchOptions,
    scene: (d: Director, sky: ShutdownSky) => Promise<T | undefined>,
  ) =>
    new Promise<{ part: Part; result: T | undefined }>((resolve) => {
      const part = enter(
        playStagedMatch(stage, options, async (d) => {
          const sky = new ShutdownSky(d.match.scene, d.state.size);
          // Never resolves by itself: it is the sky's frame callback for as long as the match lives.
          void d.until((state) => (sky.update(state, performance.now()), false)).then(() => sky.dispose());
          d.lock(true);
          // Every part of this act opens looking the way the hero was stood.
          d.match.look = { yaw: options.setup.yaw ?? SOUTH, pitch: 0 };
          resolve({ part, result: await scene(d, sky) });
        }),
      );
    });
  const cast = (at: readonly Vec2[], extra: Partial<StoryActor>): StoryActor[] =>
    kings.map((king, index) => ({ ...king, ...at[index], yaw: SOUTH, ...extra }));

  /** The voice from the sky, the bar, and the three who drop in: a match where nothing can be hurt. */
  const prologue = async () => {
    let parked = true;
    const { part, result } = await staged(
      {
        mapId: MAP,
        skin: HERO_SKIN,
        setup: {
          spawn: spots.hero,
          yaw: NORTH,
          cast: [
            {
              id: "lulu",
              name: "露露",
              color: "#c8382e",
              skin: "story-lulu",
              ...spots.lulu,
              yaw: EAST,
              passive: true,
            },
            ...cast(spots.landing, { passive: true }),
          ],
        },
      },
      async (d, sky) => {
        const lift = (height: number) =>
          d.match.mutate((state) => {
            for (const p of state.players)
              if (kings.some((king) => king.id === p.id)) {
                p.elevation = height;
                p.verticalSpeed = 0;
              }
          });
        lift(PARKED);
        // Gravity would bring them down the moment the world runs, so they are held up until their cue.
        void d.until(() => (parked && lift(PARKED), !parked));
        stage.root.classList.remove("veiled");
        if (!(await d.seconds(0.8)) || !(await d.talk(lines.voice))) return;
        sky.show();
        if (!(await d.seconds(1.8)) || !(await d.talk(lines.bar.slice(0, 1)))) return;
        if (!(await over(SHUTDOWN_ART.wall, lines.bar.slice(1, 4))) || !(await d.talk(lines.bar.slice(4))))
          return;
        parked = false;
        lift(DROP);
        const landed = (state: Readonly<GameSnapshot>) =>
          kings.every((king) => state.players.find((p) => p.id === king.id)?.elevation === 0);
        if (!(await d.until(landed))) return;
        stage.host.cue("blast");
        if (!(await d.seconds(0.7))) return;
        if (!(await over(SHUTDOWN_ART.kings, lines.kings.slice(0, 4)))) return;
        return (await d.talk(lines.kings.slice(4))) || undefined;
      },
    );
    if (!result) return false;
    stage.mark(checkpoints.fight);
    return fade(() => leave(part));
  };

  /** The last fight, once. Resolves with how it ended; the won match stays up, held still. */
  const fight = async (attempt: number, opening: readonly Line[]) => {
    const difficulty = "easy";
    const { part, result } = await staged<"won" | "lost">(
      {
        mapId: MAP,
        skin: HERO_SKIN,
        setup: {
          spawn: spots.hero,
          yaw: NORTH,
          cast: cast(spots.corners, { difficulty, team: "kings" }),
          brawl: { zoneDuration: script.zoneDuration },
        },
      },
      async (d, sky) => {
        const { match } = d;
        const heroId = d.hero.id;
        const hero = (state: Readonly<GameSnapshot>) => state.players.find((p) => p.id === heroId)!;
        const standing = (state: Readonly<GameSnapshot>) =>
          state.players.filter((p) => p.id !== heroId && p.alive).length;
        sky.show();
        match.mutate((state) => {
          const p = hero(state);
          for (const [item, count] of Object.entries(KIT)) p.inventory[item] = count;
          p.credits = Math.max(p.credits, COINS);
          for (const king of state.players.filter((actor) => actor.team === "kings")) {
            king.hp = king.maxHp = attempt >= MERCY_AFTER ? 40 : 60;
            king.attack = 45;
            king.credits = 0;
          }
          // Both lesson skills carry into the fight; older saves may only contain one.
          const flags = loadStory().flags;
          const learned =
            typeof flags.act4Skills === "string" ? flags.act4Skills.split(",") : [flags.act4Skill];
          for (const skill of learned)
            if (typeof skill === "string" && skill in SKILLS && !p.skills.includes(skill))
              p.skills.push(skill);
        });
        stage.root.classList.remove("veiled");
        if (opening.length && !(await d.talk(opening))) return;
        for (const king of kings) match.setAgent(king.id, new BotAgent(king.id));
        stage.host.music("shutdown");
        match.hud = true;
        // The real match's feed, hit markers, level-ups and perk offers.
        match.live = true;
        stage.goal(goals.fight);
        d.lock(false);
        // Lessons of the act, said by the objective chip so that nothing stops the fight.
        const hint = async (alive: boolean, text: string) => {
          if (!alive || !standing(d.state) || !hero(d.state).alive) return;
          stage.goal(text);
          if ((await d.seconds(7)) && standing(d.state) && hero(d.state).alive) stage.goal(goals.fight);
        };
        void d
          .until((state) => state.zone?.warningRing !== undefined)
          .then((alive) => hint(alive, goals.zone));
        void d
          .until((state) => state.items.some((item) => item.source === "field"))
          .then((alive) => hint(alive, goals.supply));

        const decided = await d.until((state) => !hero(state).alive || !standing(state));
        for (const king of kings) match.setAgent(king.id);
        if (!decided) return;
        match.hud = false;
        match.live = false;
        d.lock(true);
        stage.goal();
        if (!hero(d.state).alive) {
          if (!(await d.seconds(1.4))) return;
          const retries = lines.retries;
          return (await d.talk(retries[attempt % retries.length])) ? "lost" : undefined;
        }
        // 97%: the bar stops one step short for as long as the two of them have things to say.
        sky.percent = 97;
        stage.host.silence();
        if (!(await d.seconds(1.2))) return;
        held = true;
        sync();
        return (await d.talk(lines.won)) ? "won" : undefined;
      },
    );
    if (result === "lost" && !(await fade(() => leave(part)))) return undefined;
    return result && { part, result };
  };

  /** The room in the morning, breakfast, and the first ordinary sentence of the year. */
  const goHome = async (previous: Part) => {
    if (!(await stage.talk(lines.home.parting))) return false;
    stage.root.dataset.kind = "film";
    const out = enter(playPullOut(stage.overlay()));
    leave(previous);
    stage.host.cue("power");
    if (!(await stage.wait(5200))) return false;
    stage.host.music("home");
    await out.done;
    if (disposed) return false;
    for (const room of [rooms.bedroom, rooms.dining]) {
      let walk: ReturnType<typeof walkRoom> | undefined;
      const swap = () => {
        leave(front);
        leave(out);
        walk = enter(walkRoom(stage, room));
      };
      if (!(await fade(swap)) || !(await walk!.left)) return false;
    }
    const table = lines.home.table;
    if (!(await stage.talk(table.slice(0, -1)))) return false;
    // The block from the street once more, as the story opened: the curtains are drawn back, and
    // the narrator's last line is read while the camera leaves the window for the sky.
    let morning: Cutscene | undefined;
    const outside = () => {
      leave(front);
      stage.root.dataset.kind = "film";
      morning = enter(playWindow(stage.overlay(), "morning"));
    };
    if (!(await fade(outside)) || !(await stage.wait(3600))) return false;
    if (!(await stage.talk(table.slice(-1)))) return false;
    // It ends on the sky, and stays up: the credits roll over it.
    await morning!.done;
    return !disposed;
  };

  /**
   * Two guides where there was one, seen by whoever comes next: a new match on the same village,
   * with the sky back, and the camera is the newcomer coming down a shaft of light onto the
   * plaza. Then a name too long for the box.
   */
  const stayHere = async (previous: Part) => {
    if (!(await stage.talk(lines.stay.parting))) return false;
    // First the evening of the day he stayed: the two of them, the village, the sun going down.
    const evening = await staged(
      {
        mapId: MAP,
        skin: HERO_SKIN,
        setup: {
          spawn: STROLL.hero[0],
          yaw: NORTH,
          cast: [
            {
              id: "lulu",
              name: "露露",
              color: "#c8382e",
              skin: "story-lulu",
              ...STROLL.lulu[0],
              yaw: NORTH,
              passive: true,
            },
          ],
        },
      },
      async (d) => {
        const playing = playStroll(stage, d, lines.stay.stroll);
        stage.root.classList.remove("veiled");
        stage.host.music("opening");
        if (!(await fade(() => leave(previous)))) return;
        return playing;
      },
    );
    if (!evening.result) return false;
    // Night falls on it; the next thing seen is another day, through someone else's eyes.
    stage.root.classList.add("switching");
    if (!(await stage.wait(FADE_MS))) return false;
    evening.result.strike();
    leave(evening.part);
    const { part, result } = await staged(
      {
        mapId: MAP,
        skin: NEWCOMER_SKIN,
        setup: {
          spawn: spots.newcomer,
          yaw: NORTH,
          cast: [
            {
              id: "zero",
              name: "零",
              color: "#7b3fd0",
              skin: HERO_SKIN,
              ...spots.guides[0],
              yaw: SOUTH,
              passive: true,
            },
            {
              id: "lulu",
              name: "露露",
              color: "#c8382e",
              skin: "story-lulu",
              ...spots.guides[1],
              yaw: SOUTH,
              passive: true,
            },
          ],
        },
      },
      async (d) => {
        const shaft = new ArrivalShaft(d.match.scene, spots.newcomer, d.state.size);
        const started = performance.now();
        const height = (now: number) => ARRIVAL.height * (1 - Math.min(1, (now - started) / ARRIVAL.ms)) ** 2;
        // The story lowers the newcomer itself: gravity would have them down before they could look.
        const lower = (now: number) =>
          d.match.mutate((state) => {
            state.players[0].elevation = height(now);
            state.players[0].verticalSpeed = 0;
          });
        lower(started);
        void d
          .until(() => {
            const now = performance.now();
            if (height(now) > 0) lower(now);
            shaft.update(now, d.state.players[0].elevation);
            return false;
          })
          .then(() => shaft.dispose());
        stage.root.classList.remove("veiled");
        // The picture is already dark from the evening before.
        if (!(await fade(() => {}))) return;
        stage.host.cue("pull");
        if (!(await d.until(() => height(performance.now()) === 0))) return;
        stage.host.cue("down");
        shaft.fade();
        return (await d.seconds(1.6)) || undefined;
      },
    );
    if (!result) return false;
    if (SHUTDOWN_ART.stay && !(await stage.art(SHUTDOWN_ART.stay))) return false;
    const { fits, spill } = lines.stay.welcome;
    const gag = enter(sayTooMuch(stage, "零", fits, spill, !!SHUTDOWN_ART.stay));
    if (!(await gag.finished)) return false;
    leave(gag);
    if (!(await stage.talk(lines.stay.after))) return false;
    // The credits roll over the panel; the village behind it can go.
    stage.root.dataset.kind = "film";
    leave(part);
    return true;
  };

  const run = async () => {
    const save = loadStory();
    const resumed = hasCheckpoint(save, checkpoints.fight) && !hasCheckpoint(save, checkpoints.done);
    stage.host.silence();
    if (!resumed && !(await prologue())) return;
    let won: Part | undefined;
    for (let attempt = 0; !won; attempt++) {
      const round = await fight(attempt, resumed && !attempt ? lines.resume : []);
      if (!round) return;
      if (round.result === "won") won = round.part;
    }

    const choice = enter(playChoice(stage));
    const ending: Ending | undefined = await choice.picked;
    if (!ending) return;
    // The picture has gone white with the way taken; the world behind it can go now.
    leave(won);
    held = false;
    if (!(await (ending === "home" ? goHome(choice) : stayHere(choice)))) return;

    const first = reachEnding(ending);
    stage.mark(checkpoints.done);
    stage.goal();
    stage.prompt();
    stage.root.dataset.kind = "film";
    const roll = rollCredits(stage, ending, SHUTDOWN_ART[ending], first);
    enter(roll);
    if (await roll.done) stage.host.finish();
  };
  void run();

  return {
    get frozen() {
      return frozen;
    },
    set frozen(value) {
      frozen = value;
      if (front && front.frozen !== undefined) front.frozen = value;
    },
    get paused() {
      return paused;
    },
    set paused(value) {
      paused = value;
      sync();
    },
    move: (x, y) => front?.move?.(x, y),
    act: () => front?.act?.(),
    dispose() {
      disposed = true;
      for (const part of [...parts]) leave(part);
    },
  };
}
