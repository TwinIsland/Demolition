import "./shutdown.css";
import { BotAgent } from "../../agents/bot-agent";
import { SKILLS } from "../../core/content";
import { TILE_SIZE } from "../../core/geometry";
import type { GameSnapshot, StoryActor, Vec2 } from "../../core/types";
import type { HomeRoom, SHUTDOWN_SCRIPT } from "../acts/shutdown";
import type { Director } from "../match/director";
import { playStagedMatch } from "../match/staged-match";
import { CheatCode } from "../cheat";
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
import { playApocalypse } from "./apocalypse";
import { ArrivalShaft } from "./arrival";
import type { Film } from "./kit";
import { ShutdownSky } from "./sky";
import { playEvening, type Evening } from "../cutscenes/evening";
import { playFarewell, type Farewell, type FarewellShot } from "../cutscenes/farewell";
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
// Yaw 0 looks north, along negative Z, and grows turning left (see match/director.ts `yawTo`).
const NORTH = 0,
  EAST = -Math.PI / 2,
  SOUTH = Math.PI;
/**
 * Where the hero's eyes go in the opening, in radians above the horizon: the writing round the
 * sky, the wall of fire under it, and the highest he follows the three on their way down.
 */
const GAZE = { sky: 0.5, wall: 0.14, drop: 0.95 };
/** Share of its usual volume the music plays at under the opening, before the fight brings it up. */
const UNDER = 0.4;
/** The last of the three, once it has got up again. */
const FINAL = { hp: 110, mercyHp: 70, attack: 55, spare: 30 };
/**
 * Its spell is the game's own terrain reset: cast `delay` seconds ahead, with a fire sweep that
 * takes `scorch` from the hero. The id only has to differ from the simulation's own.
 */
const QUAKE = { id: -5, delay: 2.4, scorch: 5 };
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
    scene: (
      d: Director,
      sky: ShutdownSky,
      screen: (film: Film) => Promise<boolean>,
    ) => Promise<T | undefined>,
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
          // A film laid over the match, which stands still under it and has the stage back after.
          const screen = async (film: Film) => {
            held = true;
            enter(film);
            await film.done;
            if (disposed) return false;
            held = false;
            leave(film);
            enter(part);
            return true;
          };
          resolve({ part, result: await scene(d, sky, screen) });
        }),
      );
    });
  const cast = (at: readonly Vec2[], extra: Partial<StoryActor>): StoryActor[] =>
    kings.map(({ id, name, color, skin }, index) => ({
      id,
      name,
      color,
      skin,
      ...at[index],
      yaw: SOUTH,
      ...extra,
    }));

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
        /** Eases the hero's eyes to `pitch` over `seconds` of match time; he keeps facing north. */
        const gaze = (pitch: number, seconds: number) => {
          const from = d.match.look.pitch,
            start = d.state.time;
          return d.until((state) => {
            const t = Math.min(1, (state.time - start) / seconds);
            d.match.look = { yaw: NORTH, pitch: from + (pitch - from) * t * t * (3 - 2 * t) };
            return t === 1;
          });
        };
        lift(PARKED);
        // Gravity would bring them down the moment the world runs, so they are held up until their cue.
        void d.until(() => (parked && lift(PARKED), !parked));
        stage.root.classList.remove("veiled");
        // The voice comes from above, and so does everything after it: he looks up before it speaks.
        if (!(await d.seconds(0.8)) || !(await gaze(GAZE.sky, 1.6)) || !(await d.talk(lines.voice))) return;
        sky.show();
        stage.host.music("shutdown", UNDER);
        if (!(await d.seconds(1.8)) || !(await d.talk(lines.bar.slice(0, 1)))) return;
        if (!(await gaze(GAZE.wall, 1.4))) return;
        if (!(await over(SHUTDOWN_ART.wall, lines.bar.slice(1, 4))) || !(await d.talk(lines.bar.slice(4))))
          return;
        if (!(await gaze(GAZE.drop, 0.7))) return;
        parked = false;
        lift(DROP);
        // His eyes come down with them: the angle to the middle one, two cells ahead, until it lands.
        const ahead = (spots.hero.z - spots.landing[1].z) * TILE_SIZE;
        const landed = (state: Readonly<GameSnapshot>) => {
          const heights = kings.map((king) => state.players.find((p) => p.id === king.id)?.elevation ?? 0);
          d.match.look = { yaw: NORTH, pitch: Math.min(GAZE.drop, Math.atan2(Math.max(...heights), ahead)) };
          return heights.every((height) => height === 0);
        };
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
      async (d, sky, screen) => {
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

        const up = (state: Readonly<GameSnapshot>) =>
          kings.filter((king) => state.players.find((p) => p.id === king.id)?.alive);
        const rest = () => {
          for (const king of kings) match.setAgent(king.id);
        };
        /** Stops the fight for a few lines, and gives it back. */
        const aside = async (said: readonly Line[]) => {
          d.lock(true);
          const alive = await d.talk(said);
          d.lock(false);
          return alive;
        };
        // The menu's cheat code, entered here, wins the fight outright: no last words, no second
        // coming. It is taken at the next moment the fight is running, never in the middle of a line.
        const code = new CheatCode();
        let cheated = false;
        const typed = (event: KeyboardEvent) => {
          if (event.ctrlKey || event.metaKey || event.altKey) return code.reset();
          if (code.press(event.code)) cheated = true;
        };
        // Releases, not presses: in a match the arrows (overhead view) and B (the supply wheel)
        // are taken by listeners that let nothing past them, and nobody stops a key coming up.
        window.addEventListener("keyup", typed, true);
        void d.until(() => false).then(() => window.removeEventListener("keyup", typed, true));
        // One goes down, says so, and whoever is left answers; the last one down gets up once.
        let left = up(d.state),
          reborn = false;
        for (;;) {
          const count = left.length;
          const running = await d.until(
            (state) => cheated || !hero(state).alive || up(state).length < count,
          );
          if (!running) {
            rest();
            return;
          }
          if (!hero(d.state).alive) break;
          if (cheated) {
            match.mutate((state) => {
              for (const king of state.players.filter((p) => p.team === "kings" && p.alive)) {
                king.hp = 0;
                king.alive = false;
              }
            });
            stage.host.cue("power");
            break;
          }
          const now = up(d.state);
          const fallen = left.filter((king) => !now.includes(king));
          left = now;
          if (now.length) {
            const said: Line[] = [];
            for (const king of fallen) said.push(...king.last);
            for (const king of now) said.push(king.mourn[now.length > 1 ? 0 : 1]);
            if (!(await d.seconds(0.6)) || !(await aside(said))) {
              rest();
              return;
            }
            continue;
          }
          if (reborn) break;
          reborn = true;
          const last = fallen[fallen.length - 1];
          rest();
          d.lock(true);
          stage.goal();
          stage.host.silence();
          if (!(await d.seconds(1.1)) || !(await d.talk(lines.rise))) return;
          stage.host.cue("power");
          const rising = screen(playApocalypse(stage.overlay(), last.color));
          // Under the film: it is whole again and stronger, and the sky is no longer the afternoon's.
          match.mutate((state) => {
            const king = state.players.find((p) => p.id === last.id)!;
            king.maxHp = attempt >= MERCY_AFTER ? FINAL.mercyHp : FINAL.hp;
            king.attack = FINAL.attack;
            // The spell's fire must not be what ends the story for a hero on his last legs.
            const self = hero(state);
            self.hp = Math.max(self.hp, Math.min(self.maxHp, FINAL.spare));
          });
          const body = d.actor(last.id);
          d.revive(last.id, { x: Math.round(body.x), z: Math.round(body.z) });
          sky.glory = true;
          if (!(await rising)) return;
          stage.host.cue("blast");
          const named = lines.risen.map((line) => ({
            ...line,
            text: line.text.replace("{name}", last.name),
          }));
          if (!(await d.talk(named))) return;
          // Its one great spell: the ground shakes, burns from where it stands, and is another ground.
          match.mutate((state) => {
            state.terrainReset = {
              id: QUAKE.id,
              ownerId: last.id,
              at: state.time + QUAKE.delay,
              scorch: QUAKE.scorch,
            };
          });
          stage.host.music("shutdown");
          if (!(await d.until((state) => state.terrainReset?.completedAt !== undefined))) return;
          if (!(await d.seconds(0.9))) return;
          match.setAgent(last.id, new BotAgent(last.id));
          left = [last];
          stage.goal(goals.last);
          d.lock(false);
        }
        window.removeEventListener("keyup", typed, true);
        rest();
        match.hud = false;
        match.live = false;
        d.lock(true);
        stage.goal();
        if (!hero(d.state).alive) {
          if (!(await d.seconds(1.4))) return;
          const retries = lines.retries;
          return (await d.talk(retries[attempt % retries.length])) ? "lost" : undefined;
        }
        // 97%: the bar stops one step short, and it is quiet for the first time since it started.
        sky.percent = 97;
        stage.host.silence();
        return (await d.seconds(1.8)) ? "won" : undefined;
      },
    );
    if (result === "lost" && !(await fade(() => leave(part)))) return undefined;
    return result && { part, result };
  };

  /**
   * What the two of them say once it is won, as a film on a set of its own: the last piece of
   * the village, afloat under the last sky. It stays up behind the choice.
   */
  const farewell = async (previous: Part) => {
    const said = lines.farewell;
    let scene!: Farewell;
    const raise = () => {
      leave(previous);
      scene = enter(playFarewell(stage.overlay()));
    };
    if (!(await fade(raise)) || !(await stage.wait(2200)) || !(await stage.talk(lines.won))) return undefined;
    const shown = async (cut: FarewellShot, words: readonly Line[], before = () => {}) =>
      (await fade(() => (before(), scene.cut(cut)))) && (await stage.wait(1800)) && (await stage.talk(words));
    // What he admits is said into the quiet. The song comes in as the camera turns to the sky:
    // its first minute is soft, and it has grown by the time the choice is on the table.
    stage.host.music("farewell");
    if (!(await shown("sky", said.sky)) || !(await shown("island", said.village))) return undefined;
    if (!(await shown("ribbon", said.ribbon))) return undefined;
    if (!(await shown("faces", said.end, () => scene.percent(98)))) return undefined;
    return scene;
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
    // First the evening of the day he stayed, as a film: the road at sunset, then supper.
    let evening!: Evening;
    const raise = () => {
      leave(previous);
      evening = enter(playEvening(stage.overlay()));
    };
    stage.host.music("opening");
    if (!(await fade(raise)) || !(await stage.wait(4800))) return false;
    if (!(await stage.talk(lines.stay.evening.road))) return false;
    const { away, table, toast } = lines.stay.evening;
    if (!(await fade(() => evening.cut("away"))) || !(await stage.wait(2600))) return false;
    if (!(await stage.talk(away)) || !(await stage.wait(1200))) return false;
    if (!(await fade(() => evening.cut("table"))) || !(await stage.wait(2800))) return false;
    if (!(await stage.talk(table))) return false;
    evening.cheers();
    if (!(await stage.wait(2400)) || !(await stage.talk(toast)) || !(await stage.wait(3200))) return false;
    // Night falls on it; the next thing seen is another day, through someone else's eyes.
    stage.root.classList.add("switching");
    if (!(await stage.wait(FADE_MS))) return false;
    leave(evening);
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
      if (round.result === "won") won = await farewell(round.part);
      if (round.result === "won" && !won) return;
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
