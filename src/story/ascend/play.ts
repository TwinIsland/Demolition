import "./ascend.css";
import * as THREE from "three";
import { ITEMS, perkById, SKILLS } from "../../core/content";
import { MUTATIONS } from "../../core/mutations";
import { STORY_TUTORIAL_REWARDS } from "../../core/story-rewards";
import type { GameEvent, GameSnapshot, PlayerInput, Vec2 } from "../../core/types";
import { field } from "../../i18n";
import { bindings, equipmentBinding, skillBinding, type BindingId } from "../../input/bindings";
import { SPOTS } from "../../modules/maps/flatland-story/layout.js";
import { world } from "../../render/arena";
import { ASCENSION_GOALS as GOALS, ASCENSION_LINES as LINES } from "../acts/ascension";
import { ASCENSION_ART } from "./assets";
import { yawTo, type Director } from "../match/director";
import { LessonMarkers } from "../match/lesson-markers";
import { SpotBeacon } from "../match/spot-beacon";
import { playStagedMatch } from "../match/staged-match";
import { seeFilm } from "../films";
import { reachCheckpoint } from "../save";
import type { Line } from "../script";
import type { ScenePlayer, Stage } from "../stage";
import { ASCENSION_HIT, ASCENSION_SPREAD, AscensionShot } from "./ascension-shot";
import { JumpShot } from "./jump-shot";
import type { Cutscene } from "../cutscenes/kit";
import { playStatusQueue } from "../cutscenes/status-queue";
import { TargetHighlight } from "./target-highlight";

const HERO = "you";
const LULU = "lulu";
const DUMMY = "dummy";
/** Facing south, across the plaza: the way the reveal reads best. */
const SOUTH = Math.PI;

/** Where each part of the act happens. Cells of the Flatland plan; see its layout for the picture. */
const PLACE = {
  hero: SPOTS.plaza.reveal,
  lulu: { x: SPOTS.plaza.reveal.x + 1, z: SPOTS.plaza.reveal.z },
  /** Cover the act opens behind the veil: the crate that closes the graveyard off from the path. */
  cleared: [{ x: 8, z: 12 }],
  /** The crate for the knife, where the hero stands to it, and where the guide waits beside it. */
  crate: { x: 5, z: 5 },
  crateFront: { x: 6, z: 5 },
  crateGuide: { x: 6, z: 6 },
  /** The lane south of the low wall: throw from here into the street beyond it. */
  lane: { x: 6, z: 3 },
  laneGuide: { x: 8, z: 3 },
  /** The street beyond the low wall, where the grenade has to land. */
  grenadeZone: [5, 6, 7, 8].map((x) => ({ x, z: SPOTS.lowWall.from.z - 1 })),
  /** The stretch of road west of the lane that the fire is to close. */
  fireZone: [
    { x: 3, z: 3 },
    { x: 4, z: 3 },
  ],
  /** The crate is built one step west of the lane, and tested by a charge one step further. */
  buildSite: { x: 5, z: 3 },
  buildCharge: { x: 4, z: 3 },
  shop: SPOTS.shop.customer,
  shopGuide: { x: 2, z: 8 },
  /** In the farm plot, down the alley west of the shop. */
  dummy: { x: 1, z: 12 },
  /** The path beside the graveyard, and the open ground between the stones. */
  graves: { x: 7, z: 12 },
  gravesGuide: { x: 6, z: 12 },
  risen: [SPOTS.graves[3], { x: 11, z: 12 }, { x: 10, z: 13 }],
} as const;

/** The sun in the painted sky stands a little east of the scene's own; this brings them together. */
const SKY_TURN = -0.28;
/** How long the illustration holds at the hit, in milliseconds. */
const PANEL_MS = 2400;
/** Actual distance sprinted, in arena cells; turns and changes of direction all count. */
const SPRINT_DISTANCE = 6;
const BANDAGE_HEALTH = { current: 80, max: 100 } as const;
const LESSON_SKILLS = ["scan", "kick"] as const;
/** How close to the middle of a marked cell counts as standing on it, in cells. */
const ON_SPOT = 0.5;
/** How long a correction stays on the objective chip, in seconds. */
const NUDGE_SECONDS = 2.6;
/** How fast the guide closes the distance once the hero is already standing on the mark. */
const CATCH_UP_SPEED = 9;
/** A turn of the hero's head towards what the lesson is about: a base time, and more per radian. */
const TURN_SECONDS = 0.35,
  TURN_SECONDS_PER_RADIAN = 0.22;

type Ability = "sprint" | "jump" | "use" | "equip" | "build" | "skill" | "perk";

const near = (a: Vec2, b: Vec2, reach: number) => Math.hypot(a.x - b.x, a.z - b.z) <= reach;
const cellOf = (p: Vec2) => ({ x: Math.round(p.x), z: Math.round(p.z) });

/** Fills `{name}` holes in a conversation: a binding's key by default, or whatever `extra` supplies. */
function fill(lines: readonly Line[], extra: Record<string, string> = {}): Line[] {
  const word = (name: string) =>
    extra[name] ?? bindings.label((name === "shield" ? equipmentBinding(name) : name) as BindingId);
  return lines.map((line) =>
    "text" in line
      ? { ...line, text: line.text.replace(/\{(\w+)\}/g, (_, name: string) => word(name)) }
      : line,
  );
}

/** Shortest walk over open floor, as the cells after `from`; empty when there is none. */
function route(state: Readonly<GameSnapshot>, from: Vec2, to: Vec2): Vec2[] {
  const size = state.size,
    start = from.z * size + from.x,
    goal = to.z * size + to.x,
    back = new Int32Array(size * size).fill(-1),
    queue = [start];
  back[start] = start;
  for (let head = 0; head < queue.length && back[goal] < 0; head++) {
    const cell = queue[head],
      x = cell % size,
      z = Math.floor(cell / size);
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const next = (z + dz) * size + x + dx;
      if (state.tiles[z + dz]?.[x + dx] !== 0 || back[next] >= 0) continue;
      back[next] = cell;
      queue.push(next);
    }
  }
  const path: Vec2[] = [];
  if (back[goal] < 0) return path;
  for (let cell = goal; cell !== start; cell = back[cell])
    path.unshift({ x: cell % size, z: Math.floor(cell / size) });
  return path;
}

/** `replay` is the collection's showing of the ascension alone: it ends once he has spoken. */
export function playAscension(stage: Stage, replay = false): ScenePlayer {
  let sky: THREE.Texture | undefined;
  let film: Cutscene | undefined;
  const player = playStagedMatch(
    stage,
    {
      mapId: "flatland-story",
      skin: "story-zero",
      setup: {
        spawn: PLACE.hero,
        yaw: SOUTH,
        overhead: true,
        tutorial: true,
        cast: [
          {
            id: LULU,
            name: "露露",
            color: "#c8423f",
            skin: "story-lulu",
            ...PLACE.lulu,
            yaw: SOUTH,
            passive: true,
          },
          {
            id: DUMMY,
            name: "训练靶",
            color: "#9aa0a6",
            skin: "story-zhangsan",
            ...PLACE.dummy,
            yaw: 0,
            passive: true,
          },
        ],
      },
    },
    (director) =>
      act(
        director,
        (texture) => (sky = texture),
        (next) => {
          film = next;
          if (next) next.paused = player.paused;
          return next as never;
        },
        replay,
      ).catch((error) => {
        // A scene that throws must not leave the player in front of a frozen picture.
        console.error(error);
        stage.end("act4-done");
      }),
  );
  return {
    ready: player.ready,
    get frozen() {
      return player.frozen;
    },
    set frozen(value) {
      player.frozen = value;
    },
    get paused() {
      return player.paused;
    },
    set paused(value) {
      player.paused = value;
      if (film) film.paused = value;
    },
    move: player.move,
    act: player.act,
    dispose() {
      player.dispose();
      film?.dispose();
      stage.root.querySelector(".ascend-fx")?.remove();
      stage.root.classList.remove("ascend-bars");
      sky?.dispose();
    },
  };
}

async function act(
  d: Director,
  keepSky: (texture: THREE.Texture) => void,
  /** Hands the player a film laid over the match, to pause and close with it; undefined takes it back. */
  showing: <T extends Cutscene | undefined>(film?: T) => T,
  replay: boolean,
) {
  const { stage, match } = d;
  const { renderer } = match;
  const size = d.state.size;
  const at = (cell: Vec2) => ({ x: world(cell.x, size), z: world(cell.z, size) });

  // --- The strings this act pulls -----------------------------------------------------------

  const allowed = new Set<Ability>();
  /** The only cells a throw may land on, and the only cell a crate may be built on, when set. */
  let throwZone: readonly Vec2[] | undefined, buildSite: Vec2 | undefined;
  const within = (cells: readonly Vec2[], cell?: Vec2) =>
    !!cell && cells.some((c) => c.x === cell.x && c.z === cell.z);
  match.gate = (input: PlayerInput) => {
    const out = { ...input };
    if (!allowed.has("sprint")) out.sprint = false;
    if (!allowed.has("jump")) out.jump = false;
    if (!allowed.has("use")) out.useEquipment = out.plantHere = false;
    if (!allowed.has("equip")) delete out.equip;
    if (!allowed.has("build")) out.build = false;
    if (!allowed.has("skill")) delete out.activateSkill;
    if (!allowed.has("perk")) delete out.usePerk;
    // The supply shop and the practice reset belong to a real match.
    delete out.buyItem;
    out.resetTerrain = false;
    // A lesson with a marked area takes nothing outside it, and says why.
    const you = match.state.players[0];
    if (
      throwZone &&
      out.useEquipment &&
      ITEMS[you.equipped]?.throwable &&
      !within(throwZone, out.aimTarget)
    ) {
      out.useEquipment = false;
      nudge(GOALS.throwOutside);
    }
    if (buildSite && out.build) {
      if (out.buildTarget && !within([buildSite], out.buildTarget)) {
        out.build = false;
        nudge(GOALS.buildOutside);
      } else if (Math.abs(you.x - buildSite.x) < 0.9 && Math.abs(you.z - buildSite.z) < 0.9) {
        // A crate cannot go up on the cell the builder is standing in.
        out.build = false;
        nudge(GOALS.buildTooClose);
      } else out.buildTarget = buildSite;
    }
    return out;
  };

  /** Per-frame work of the act's own, run after the director's. */
  const steps = new Set<(state: Readonly<GameSnapshot>, dt: number, real: number) => void>();
  const directed = match.onFrame;
  match.onFrame = (state, dt, real) => {
    directed?.(state, dt, real);
    for (const step of [...steps]) step(state, dt, real);
  };

  /** The objective chip, and a correction that takes its place for a moment. */
  let goalText: string | undefined,
    nudged = 0;
  const goal = (text?: string) => {
    goalText = text;
    if (nudged <= 0) stage.goal(text);
  };
  const nudge = (text: string) => {
    if (nudged <= 0) stage.goal(text);
    nudged = NUDGE_SECONDS;
  };
  steps.add((_, dt) => {
    if (nudged > 0 && (nudged -= dt) <= 0) stage.goal(goalText);
  });

  /** What the lesson points at: the cell to stand on, and the cells to throw or build on. */
  const beacon = new SpotBeacon(match.scene);
  const mark = () => stage.host.cue("mark");
  const area = new LessonMarkers(match.scene, "#22e06a", mark);
  const framed = new LessonMarkers(match.scene, undefined, mark);
  /** The cell to stand on, and things to act on: each framed for as long as it still stands. */
  let spot: Vec2 | undefined,
    targets: readonly Vec2[] = [];
  steps.add((state) => {
    beacon.show(spot, state.size, state.time);
    area.show(throwZone ?? (buildSite ? [buildSite] : []), state.size, state.time);
    framed.show(
      targets.filter((cell) => state.tiles[cell.z]?.[cell.x] === 2),
      state.size,
      state.time,
    );
  });
  // Released when the story is closed, whichever lesson it was in.
  void d
    .until(() => false)
    .then(() => {
      beacon.dispose();
      area.dispose();
      framed.dispose();
    });
  /** Lights a cell and waits until the hero stands on it: the next step starts nowhere else. */
  const standOn = async (cell: Vec2, text: string) => {
    spot = cell;
    goal(text);
    const open = await d.until((state) => state.players[0].alive && near(state.players[0], cell, ON_SPOT));
    spot = undefined;
    return open;
  };
  /** Limits throws to the open cells of `cells`, or lifts the limit. */
  const aimAt = (cells?: readonly Vec2[]) => {
    throwZone = cells?.filter((cell) => d.state.tiles[cell.z]?.[cell.x] === 0);
    match.mutate((state) => {
      if (throwZone) state.storyThrowZone = throwZone.map((cell) => ({ ...cell }));
      else delete state.storyThrowZone;
    });
  };

  /** A conversation with the world still moving, for lines that are staged; the hero stands by. */
  const say = async (lines: readonly Line[], extra?: Record<string, string>) => {
    d.lock(true);
    const open = await d.talk(fill(lines, extra), { live: true });
    d.lock(false);
    return open;
  };
  const hero = (change: (p: GameSnapshot["players"][number], state: GameSnapshot) => void) =>
    match.mutate((state) => change(state.players[0], state));
  const give = (item: string, count: number) => hero((p) => (p.inventory[item] = count));
  /** Events of the hero's since `time`. */
  const since = (state: Readonly<GameSnapshot>, time: number) =>
    state.events.filter((e): e is GameEvent => e.playerId === HERO && e.at >= time);

  /** Where the hero comes back if a lesson goes wrong, and the words for it. */
  let anchor: Vec2 = PLACE.hero;
  let fallen = 0;
  steps.add((state, dt) => {
    const you = state.players[0];
    if (you.alive) return void (fallen = 0);
    if ((fallen += dt) < 1.2) return;
    fallen = 0;
    d.revive(HERO, anchor);
    void say(LINES.revived);
  });

  /**
   * Holds the hero where he stands and brings his eyes round to `target`, eased, the short way.
   * He is left held: what follows, a conversation or the caller, lets him go.
   */
  const turn = async (target: Vec2, pitch = 0) => {
    d.lock(true);
    const from = match.look,
      to = yawTo(d.hero, target),
      arc = Math.atan2(Math.sin(to - from.yaw), Math.cos(to - from.yaw)),
      rise = pitch - from.pitch;
    if (Math.abs(arc) < 0.02 && Math.abs(rise) < 0.02) return true;
    const length = TURN_SECONDS + TURN_SECONDS_PER_RADIAN * Math.abs(arc);
    let time = 0;
    const ease = (_: Readonly<GameSnapshot>, __: number, real: number) => {
      time = Math.min(length, time + real);
      const t = time / length,
        k = t * t * (3 - 2 * t);
      match.look = { yaw: from.yaw + arc * k, pitch: from.pitch + rise * k };
    };
    steps.add(ease);
    const open = await d.until(() => time >= length);
    steps.delete(ease);
    if (open) match.look = { yaw: to, pitch };
    return open;
  };
  /** The pitch that puts a cell on the ground in the middle of the view from where the hero is. */
  const down = (cell: Vec2) =>
    -Math.atan2(0.65, Math.max(1, Math.hypot(cell.x - d.hero.x, cell.z - d.hero.z)));

  /**
   * The guide walks ahead over open floor, never far from the hero, and waits at `guide`. The lit
   * cell is what counts: a hero who gets there first, by any road, is held on it while she runs
   * the rest of the way. He is left held.
   */
  const lead = async (to: Vec2, guide: Vec2) => {
    spot = to;
    goal(GOALS.follow);
    anchor = to;
    let arrived = false;
    const walk = (async () => {
      for (const cell of route(d.state, cellOf(d.actor(LULU)), guide)) {
        if (!(await d.until((state) => arrived || near(state.players[0], cell, 4.5)))) return false;
        if (!(await d.walk(LULU, cell, arrived ? CATCH_UP_SPEED : 3.4))) return false;
      }
      return true;
    })();
    if (!(await d.until((state) => state.players[0].alive && near(state.players[0], to, ON_SPOT))))
      return false;
    arrived = true;
    spot = undefined;
    d.lock(true);
    goal();
    if (!(await walk)) return false;
    d.face(LULU, d.hero);
    return true;
  };

  let nextId = -1;
  const plant = (cell: Vec2, fuse: number) => {
    const id = nextId--;
    match.mutate((state) =>
      state.bombs.push({
        id,
        ownerId: LULU,
        x: cell.x,
        z: cell.z,
        power: 70,
        range: 2,
        detonateAt: state.time + fuse,
        passThrough: state.players.map((p) => p.id),
      }),
    );
    return id;
  };
  /** Resolves once the charge has gone off and its fire is out. */
  const detonated = (id: number) =>
    d.until(
      (state) => !state.bombs.some((b) => b.id === id) && !state.blasts.some((b) => b.ownerId === LULU),
    );
  const free = (state: Readonly<GameSnapshot>, cell: Vec2) =>
    state.tiles[cell.z]?.[cell.x] === 0 && !state.players.some((p) => p.alive && near(p, cell, 0.6));

  // --- Arrival: the turn from two dimensions to three ---------------------------------------

  for (const cell of PLACE.cleared) d.tile(cell, 0);
  hero((p) => {
    p.credits = 0;
    p.crates = 0;
  });
  match.look = { yaw: SOUTH, pitch: 0 };
  d.lock(true);
  // The painted sky and the panel are fetched, decoded and uploaded while the veil is still down:
  // nothing may hitch at the moment the device goes off.
  const skyReady = new THREE.TextureLoader()
    .loadAsync(ASCENSION_ART.sky)
    .then((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.mapping = THREE.EquirectangularReflectionMapping;
      keepSky(texture);
      renderer.renderer.initTexture(texture);
      return texture;
    })
    .catch((error) => void console.error(error));
  const panel = new Image();
  panel.src = ASCENSION_ART.panel;
  await Promise.race([Promise.all([skyReady, panel.decode().catch(() => {})]), stage.wait(4000)]);
  stage.root.classList.remove("veiled");
  if (!(await d.seconds(0.9))) return;
  if (!(await d.talk(fill(LINES.trigger), { live: true }))) return;

  const fx = document.createElement("div");
  fx.className = "ascend-fx";
  stage.root.append(fx);
  const flash = () => {
    fx.classList.remove("flash");
    void fx.offsetWidth;
    fx.classList.add("flash");
  };

  seeFilm("ascension");
  const shot = new AscensionShot(at(PLACE.hero).x, at(PLACE.hero).z, SOUTH, at(PLACE.lulu));
  let rolling = true;
  const roll = (_: Readonly<GameSnapshot>, dt: number) => {
    if (rolling) shot.time += dt;
    renderer.dimension = shot.look;
    if (shot.time >= ASCENSION_SPREAD) steps.delete(roll);
  };
  steps.add(roll);
  renderer.stagedShot = shot;
  renderer.dimension = shot.look;
  stage.host.silence();
  // The device winds up over the lead-in, in the hush before the track.
  stage.host.cue("ascendCharge");
  stage.root.classList.add("ascend-bars");
  void skyReady.then((texture) => texture && renderer.paintSky(texture, SKY_TURN));

  // The world breaks into blocks, the ascension track comes in, and for a moment it is a drawing.
  if (!(await d.until(() => shot.time >= ASCENSION_HIT - 0.05))) return;
  rolling = false;
  flash();
  stage.host.music("ascension");
  stage.host.cue("pull");
  stage.host.cue("ascendHit");
  void stage.art(ASCENSION_ART.panel, { cut: true });
  stage.root.querySelector(".stage-art")?.classList.add("ascend-push");
  if (!(await stage.wait(PANEL_MS))) return;
  flash();
  stage.art();
  stage.root.querySelector(".stage-art")?.classList.remove("ascend-push");
  // From here on the hero sees with his own eyes; the shot keeps the camera until it gets there.
  hero((p) => delete p.tacticalView);
  rolling = true;
  if (!(await d.until(() => shot.done))) return;
  renderer.stagedShot = undefined;
  stage.root.classList.remove("ascend-bars");

  if (!(await say(LINES.arrive))) return;
  if (replay) return stage.end("act4-done");
  // She turns on the spot, after a back she cannot get in front of.
  let spin = 0;
  const chase = (_: Readonly<GameSnapshot>, dt: number) => {
    spin += dt;
    match.mutate((state) => {
      const lulu = state.players.find((p) => p.id === LULU);
      if (lulu) lulu.yaw = SOUTH + Math.sin(spin * 5) * 1.1 + spin * 2.4;
    });
  };
  steps.add(chase);
  if (!(await say(LINES.back))) return;
  steps.delete(chase);
  d.put(LULU, PLACE.lulu, SOUTH);
  stage.art(ASCENSION_ART.sky4b);
  if (!(await say(LINES.sky.slice(0, 3)))) return;
  stage.art();
  if (!(await say(LINES.sky.slice(3)))) return;
  stage.mark("act4-arrive");

  // --- 4.1 Looking, sprinting, jumping -------------------------------------------------------

  stage.host.music("lesson");
  match.hud = ["crosshair"];
  match.live = true;
  if (!(await say(LINES.look))) return;
  goal(GOALS.look);
  let turned = 0,
    lastYaw = match.look.yaw;
  if (
    !(await d.until(() => {
      turned += Math.abs(match.look.yaw - lastYaw);
      lastYaw = match.look.yaw;
      return turned > 4.5;
    }))
  )
    return;

  match.hud = ["stamina"];
  if (!(await say(LINES.sprint))) return;
  allowed.add("sprint");
  const sprintGoal = GOALS.sprint.replace("{sprint}", bindings.label("sprint"));
  let sprinted = 0,
    sprintProgress = -1,
    lastSprintPosition = { x: d.hero.x, z: d.hero.z, alive: d.hero.alive };
  if (
    !(await d.until((state) => {
      const you = state.players[0];
      if (you.alive && lastSprintPosition.alive && you.sprinting)
        sprinted += Math.hypot(you.x - lastSprintPosition.x, you.z - lastSprintPosition.z);
      lastSprintPosition = { x: you.x, z: you.z, alive: you.alive };
      const progress = Math.min(SPRINT_DISTANCE, Math.floor(sprinted));
      if (progress !== sprintProgress) {
        sprintProgress = progress;
        goal(`${sprintGoal} (${progress}/${SPRINT_DISTANCE})`);
      }
      return sprinted >= SPRINT_DISTANCE;
    }))
  )
    return;
  goal();
  allowed.delete("sprint");
  if (!(await say(LINES.winded))) return;
  allowed.add("sprint").add("jump");
  goal(GOALS.jump);
  const jump = async () =>
    (await d.until((state) => state.players[0].elevation > 0.35)) &&
    (await d.until((state) => state.players[0].elevation === 0));
  // The first one is held: the camera leaves his eyes and goes once round him in the air.
  if (!(await d.until((state) => state.players[0].elevation > 0.08))) return;
  {
    const leap = new JumpShot(match.look);
    const hud = match.hud;
    const hold = (state: Readonly<GameSnapshot>, _: number, real: number) => {
      leap.advance(real, state);
      match.rate = leap.rate;
    };
    d.lock(true);
    stage.goal();
    match.hud = false;
    steps.add(hold);
    renderer.stagedShot = leap;
    stage.root.classList.add("ascend-bars");
    const open = await d.until(() => leap.done);
    steps.delete(hold);
    match.rate = 1;
    if (!open) return;
    renderer.stagedShot = undefined;
    stage.root.classList.remove("ascend-bars");
    match.hud = hud;
    d.lock(false);
    if (!(await d.until((state) => state.players[0].elevation === 0))) return;
  }
  if (!(await say(LINES.jumped))) return;
  goal(GOALS.jumpAgain);
  if (!(await jump())) return;
  if (!(await say(LINES.jumpedAgain))) return;

  // --- 4.2 Gear ------------------------------------------------------------------------------

  void (async () => {
    for (const cell of route(d.state, cellOf(d.actor(LULU)), PLACE.crateGuide))
      if (!(await d.walk(LULU, cell, 3.4))) return;
    d.face(LULU, PLACE.crate);
  })();
  match.hud = ["crosshair", "equipment"];
  if (!(await say(LINES.hands))) return;
  allowed.add("equip");
  anchor = PLACE.crateFront;
  if (!(await standOn(PLACE.crateFront, GOALS.crateSpot))) return;
  if (!(await turn(PLACE.crate, -0.2))) return;
  d.lock(false);
  const knifeStarted = d.state.time;
  allowed.add("use");
  targets = [PLACE.crate];
  const knifeGoal = (equipped: boolean) =>
    goal(
      (equipped ? GOALS.knifeCut : GOALS.knife)
        .replace("{gearWheel}", bindings.label("gearWheel"))
        .replace("{use}", bindings.label("use")),
    );
  let knifeEquipped = d.hero.equipped === "knife";
  knifeGoal(knifeEquipped);
  // The lesson teaches cutting cover, so any cover the hero actually cuts with the knife counts.
  if (
    !(await d.until((state) => {
      const equipped = state.players[0].equipped === "knife";
      if (equipped !== knifeEquipped) {
        knifeEquipped = equipped;
        knifeGoal(equipped);
      }
      return since(state, knifeStarted).some((event) => event.type === "cover" && event.item === "knife");
    }))
  )
    return;
  targets = [];
  goal();
  if (!(await say(LINES.knifed))) return;

  if (!(await say(LINES.toWall))) return;
  if (!(await lead(PLACE.lane, PLACE.laneGuide))) return;
  give("grenade", 3);
  hero((p) => (p.equipped = "grenade"));
  const landing = { x: PLACE.lane.x, z: SPOTS.lowWall.from.z - 1 };
  if (!(await turn(landing, down(landing)))) return;
  if (!(await say(LINES.grenade))) return;
  aimAt(PLACE.grenadeZone);
  goal(GOALS.grenade.replace("{use}", bindings.label("use")));
  // Beyond the wall means north of it; a grenade that falls short is handed back.
  const wall = SPOTS.lowWall.from.z;
  const refill = (state: Readonly<GameSnapshot>) => {
    if (!state.players[0].inventory.grenade && !state.thrown.length) give("grenade", 1);
  };
  steps.add(refill);
  if (!(await d.until((state) => state.blasts.some((b) => b.source === "throwable" && b.z < wall)))) return;
  steps.delete(refill);
  if (!(await d.seconds(0.6))) return;
  if (!(await say(LINES.grenadeDone))) return;

  aimAt();
  give("molotov", 2);
  hero((p) => (p.equipped = "molotov"));
  if (!(await turn(PLACE.fireZone[0], down(PLACE.fireZone[0])))) return;
  if (!(await say(LINES.molotov))) return;
  aimAt(PLACE.fireZone);
  goal(GOALS.molotov.replace("{use}", bindings.label("use")));
  if (!(await d.until((state) => state.fires.length > 0))) return;
  aimAt();
  goal();
  if (!(await d.seconds(0.8))) return;
  if (!(await say(LINES.molotovDone))) return;
  // Nobody learns anything standing in a fire: wait it out.
  if (!(await d.until((state) => !state.fires.length))) return;

  match.hud = ["crosshair", "equipment", "shield"];
  const readyShield = () => {
    give("shield", 1);
    hero((p) => {
      p.hp = p.maxHp;
      p.shield = 0;
      p.equipped = "shield";
    });
  };
  readyShield();
  if (!(await say(LINES.shield))) return;
  for (;;) {
    goal(GOALS.shield.replace("{use}", bindings.label("use")));
    if (!(await d.until((state) => state.players[0].shield > 0))) return;
    const raised = d.state.time;
    // Once raised, stage the demonstration without movement or another confirmation click.
    d.lock(true);
    goal(GOALS.shieldHold);
    const here = cellOf(d.hero);
    const beside = [
      { x: here.x + 1, z: here.z },
      { x: here.x - 1, z: here.z },
      { x: here.x, z: here.z + 1 },
      { x: here.x, z: here.z - 1 },
    ].find((cell) => free(d.state, cell));
    const charge = plant(beside ?? here, 1.5);
    let held = false;
    if (
      !(await d.until((state) => {
        // Remember the block as it happens, even if its event is pruned before the fire clears.
        held ||= since(state, raised).some(
          (e) => (e.type === "shield-end" && e.reason === "broken") || (e.type === "hurt" && e.blocked),
        );
        return (
          !state.bombs.some((bomb) => bomb.id === charge) &&
          !state.blasts.some((blast) => blast.explosionId === charge)
        );
      }))
    )
      return;
    if (held) break;
    readyShield();
    if (!(await say(LINES.shieldRetry))) return;
  }
  goal();
  if (!(await say([...LINES.shieldUp, ...LINES.shieldDone]))) return;
  // A controlled injury: one bandage visibly restores 80/100 to full health.
  match.hud = ["equipment", "health"];
  stage.host.cue("blast");
  hero((p) => {
    p.maxHp = BANDAGE_HEALTH.max;
    p.hp = BANDAGE_HEALTH.current;
    p.shield = 0;
    p.equipped = "bandage";
  });
  give("bandage", 1);
  const bandageStarted = d.state.time;
  const bandageUsed = (state: Readonly<GameSnapshot>) =>
    since(state, bandageStarted).some((event) => event.type === "equipment" && event.item === "bandage");
  const holdBandageHealth = (state: Readonly<GameSnapshot>) => {
    if (!bandageUsed(state))
      hero((p) => {
        p.maxHp = BANDAGE_HEALTH.max;
        p.hp = BANDAGE_HEALTH.current;
      });
  };
  steps.add(holdBandageHealth);
  if (!(await say(LINES.bleeding))) return;
  goal(GOALS.bandage.replace("{use}", bindings.label("use")));
  if (!(await d.until(bandageUsed))) return;
  steps.delete(holdBandageHealth);
  goal();
  if (!(await say(LINES.bandaged))) return;

  match.hud = ["crosshair", "crates"];
  hero((p) => (p.crates = 3));
  if (!(await say(LINES.build))) return;
  // Built from the lane onto the one lit cell, so the charge that tests it has a place prepared.
  const guided = free(d.state, PLACE.buildSite) && free(d.state, PLACE.buildCharge);
  if (guided) {
    anchor = PLACE.lane;
    if (!(await standOn(PLACE.lane, GOALS.buildSpot))) return;
    if (!(await turn(PLACE.buildSite, -0.45))) return;
    d.lock(false);
    buildSite = PLACE.buildSite;
  }
  allowed.add("build");
  goal(GOALS.build.replace("{build}", bindings.label("build")));
  const before = d.state.builtCrates?.length ?? 0;
  if (!(await d.until((state) => (state.builtCrates?.length ?? 0) > before))) return;
  buildSite = undefined;
  const crate = d.state.builtCrates!.at(-1)!;
  if (!(await say(LINES.built))) return;
  if (guided) {
    // Behind the crate means the lane cell: the fire line stops one step short of it.
    if (!(await standOn(PLACE.lane, GOALS.hide))) return;
    goal();
    if (!(await turn(PLACE.buildSite, -0.2))) return;
    hero((p, state) => (p.invulnerableUntil = state.time + 4));
    if (free(d.state, PLACE.buildCharge) && !(await detonated(plant(PLACE.buildCharge, 1.6)))) return;
    d.lock(false);
  } else {
    // A charge on the far side of the crate from the hero: the crate takes the fire line.
    const you = cellOf(d.hero),
      dx = Math.sign(crate.x - you.x),
      dz = Math.sign(crate.z - you.z);
    const beyond = [
      Math.abs(crate.x - you.x) >= Math.abs(crate.z - you.z)
        ? { x: crate.x + dx, z: crate.z }
        : { x: crate.x, z: crate.z + dz },
      { x: crate.x + dx, z: crate.z },
      { x: crate.x, z: crate.z + dz },
    ].find((cell) => (cell.x !== crate.x || cell.z !== crate.z) && free(d.state, cell));
    if (beyond) {
      hero((p, state) => (p.invulnerableUntil = state.time + 4));
      if (!(await detonated(plant(beyond, 1.6)))) return;
    }
  }
  if (!(await say(LINES.blocked))) return;
  hero((p) => {
    p.hp = p.maxHp;
    p.crates = 3;
  });
  stage.mark("act4-gear");

  // --- 4.3 The skill shop and the first level ------------------------------------------------

  match.hud = ["coins"];
  if (!(await say(LINES.toShop))) return;
  if (!(await lead(PLACE.shop, PLACE.shopGuide))) return;
  d.lock(false);
  hero((p) => (p.credits = LESSON_SKILLS.reduce((total, id) => total + SKILLS[id].price, 0)));
  goal(GOALS.shop);
  for (;;) {
    if (!(await match.shop({ requiredSkills: LESSON_SKILLS }))) return;
    if (LESSON_SKILLS.every((id) => d.hero.skills.includes(id))) break;
    if (!(await say(LINES.shopEmpty))) return;
  }
  goal();
  const skill = SKILLS.scan;
  match.hud = ["crosshair", "skills"];
  allowed.add("skill");
  if (
    !(await say(LINES.castPassive, {
      name: field(SKILLS.kick, "name"),
      description: field(SKILLS.kick, "description"),
    }))
  )
    return;
  if (skill.passive) {
    if (
      !(await say(LINES.castPassive, {
        name: field(skill, "name"),
        description: field(skill, "description"),
      }))
    )
      return;
  } else {
    if (
      !(await say(LINES.cast, {
        skill: bindings.label(skillBinding(skill.id)),
        name: field(skill, "name"),
        description: field(skill, "description"),
      }))
    )
      return;
    goal(GOALS.cast);
    const asked = d.state.time;
    if (!(await d.until((state) => since(state, asked).some((e) => e.type === "skill")))) return;
    if (!(await say(LINES.castDone))) return;
  }

  match.hud = ["crosshair", "equipment", "skills", "health", "progression"];
  d.face(DUMMY, d.hero);
  if (!(await turn(d.actor(DUMMY)))) return;
  const targetHighlight = new TargetHighlight(match.scene);
  const markTarget = (state: Readonly<GameSnapshot>) =>
    targetHighlight.update(
      state.players.find((p) => p.id === DUMMY),
      state.size,
    );
  const clearTarget = () => {
    steps.delete(markTarget);
    targetHighlight.dispose();
  };
  markTarget(d.state);
  steps.add(markTarget);
  // Also release GPU resources if the player exits while the introduction dialogue is open.
  void d.until(() => false).then(clearTarget);
  try {
    if (!(await say(LINES.target))) return;
    match.mutate((state) => {
      const dummy = state.players.find((p) => p.id === DUMMY)!;
      dummy.invulnerableUntil = 0;
    });
    goal(GOALS.target);
    if (!(await d.until((state) => !state.players.find((p) => p.id === DUMMY)?.alive))) return;
  } finally {
    clearTarget();
  }
  // Felling it is worth a level whatever it was felled with.
  hero((p) => (p.xp = Math.max(p.xp, p.nextLevel)));
  if (!(await d.until((state) => state.players[0].offers.length > 0))) return;
  allowed.add("perk");
  match.hud = ["progression", "perks"];
  if (!(await say(LINES.levelled))) return;
  goal(GOALS.perk);
  if (!(await d.until((state) => !state.players[0].offers.length && state.players[0].perks.length > 0)))
    return;
  const perk = perkById(d.hero.perks.at(-1)!);
  if (
    !(await say(LINES.perk, {
      name: perk ? field(perk, "name") : "强化",
      description: perk ? field(perk, "description") : "选择后自动生效。",
    }))
  )
    return;
  reachCheckpoint("act4-skill", {
    act4Skill: skill.id,
    act4Skills: LESSON_SKILLS.join(","),
    act4Perk: perk?.id ?? "",
  });

  // --- 4.4 The ones who did not clear the game -----------------------------------------------

  match.hud = ["crosshair", "equipment", "skills", "health", "stamina", "perks"];
  if (!(await say(LINES.toGraves))) return;
  stage.host.silence();
  if (!(await lead(PLACE.graves, PLACE.gravesGuide))) return;
  const rise = (cell: Vec2, level: 1 | 2 | 3, gift = false) =>
    match.mutate((state) =>
      state.zombies.push({
        id: nextId--,
        level,
        gift: gift || undefined,
        x: cell.x,
        z: cell.z,
        yaw: 0,
        spawnAt: state.time,
        destination: { ...cell },
      }),
    );
  const open = PLACE.risen.filter((cell) => free(d.state, cell));
  // He is already held on the mark; his eyes go to the stones before anything comes out of them.
  if (!(await turn(open[0] ?? PLACE.risen[0]))) return;
  hero((p, state) => {
    p.hp = p.maxHp;
    p.invulnerableUntil = state.time + 3;
  });
  rise(open[0] ?? PLACE.risen[0], 1);
  rise(open[1] ?? PLACE.risen[1], 1);
  if (!(await d.seconds(1.3))) return;
  stage.art(ASCENSION_ART.risen);
  // The world holds its breath from here until the narrator has had his line.
  match.rate = 0;
  if (!(await d.talk(fill(LINES.risen.slice(0, 5))))) return;
  stage.art();
  if (!(await stage.wait(700))) return;
  {
    // Nobody answers her. What answers is a film: everyone who ever called for a status window.
    const hud = match.hud;
    match.hud = false;
    seeFilm("status-queue");
    const film = showing(playStatusQueue(stage.overlay()));
    await film.done;
    // It ends in the dark; the graveyard comes back up out of the same dark.
    stage.root.classList.add("veiled");
    film.dispose();
    showing();
    if (!(await stage.wait(150))) return;
    stage.root.classList.remove("veiled");
    if (!(await stage.wait(450))) return;
    match.hud = hud;
  }
  if (!(await d.talk(fill(LINES.risen.slice(5))))) return;
  match.rate = 1;
  if (!(await d.talk(fill(LINES.fight)))) return;
  // The hush was for the graves: the fight itself has music again, until the act ends.
  stage.host.music("duel");
  d.lock(false);
  anchor = PLACE.gravesGuide;
  goal(GOALS.zombies);
  if (!(await d.until((state) => state.zombies.length < 2))) return;
  const fought = d.state.time;
  rise(open[2] ?? open[0] ?? PLACE.risen[2], 3, true);
  if (!(await d.seconds(1.3))) return;
  if (!(await d.talk(fill(LINES.mutant)))) return;
  if (!(await d.until((state) => !state.zombies.length))) return;
  goal();
  if (!(await d.seconds(1))) return;
  if (since(d.state, fought).some((e) => e.type === "mutation")) {
    d.lock(true);
    if (!(await d.until(() => !match.mutationNoticePending))) return;
    const mutation = MUTATIONS[STORY_TUTORIAL_REWARDS.mutation];
    if (
      !(await say(LINES.mutated, {
        name: field(mutation, "name"),
        description: field(mutation, "description"),
      }))
    )
      return;
  }
  d.lock(true);
  stage.end("act4-done");
}
