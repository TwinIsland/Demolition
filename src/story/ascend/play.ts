import "./ascend.css";
import * as THREE from "three";
import { perkById, SKILLS } from "../../core/content";
import type { GameEvent, GameSnapshot, PlayerInput, Vec2 } from "../../core/types";
import { field } from "../../i18n";
import { bindings, equipmentBinding, skillBinding, type BindingId } from "../../input/bindings";
import { SPOTS } from "../../modules/maps/flatland-story/layout.js";
import { world } from "../../render/arena";
import { ASCENSION_GOALS as GOALS, ASCENSION_LINES as LINES } from "../acts/ascension";
import { ASCENSION_ART } from "./assets";
import type { Director } from "../match/director";
import { playStagedMatch } from "../match/staged-match";
import { reachCheckpoint } from "../save";
import type { Line } from "../script";
import type { ScenePlayer, Stage } from "../stage";
import { ASCENSION_HIT, ASCENSION_SPREAD, AscensionShot } from "./ascension-shot";

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

export function playAscension(stage: Stage): ScenePlayer {
  let sky: THREE.Texture | undefined;
  const player = playStagedMatch(
    stage,
    {
      mapId: "flatland-story",
      skin: "story-zero",
      setup: {
        spawn: PLACE.hero,
        yaw: SOUTH,
        overhead: true,
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
          { id: DUMMY, name: "训练靶", color: "#9aa0a6", skin: "story-zhangsan", ...PLACE.dummy, yaw: 0 },
        ],
      },
    },
    (director) =>
      act(director, (texture) => (sky = texture)).catch((error) => {
        // A scene that throws must not leave the player in front of a frozen picture.
        console.error(error);
        stage.end("act4-done");
      }),
  );
  return {
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
    },
    move: player.move,
    act: player.act,
    dispose() {
      player.dispose();
      stage.root.querySelector(".ascend-fx")?.remove();
      stage.root.classList.remove("ascend-bars");
      sky?.dispose();
    },
  };
}

async function act(d: Director, keepSky: (texture: THREE.Texture) => void) {
  const { stage, match } = d;
  const { renderer } = match;
  const size = d.state.size;
  const at = (cell: Vec2) => ({ x: world(cell.x, size), z: world(cell.z, size) });

  // --- The strings this act pulls -----------------------------------------------------------

  const allowed = new Set<Ability>();
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
    return out;
  };

  /** Per-frame work of the act's own, run after the director's. */
  const steps = new Set<(state: Readonly<GameSnapshot>, dt: number) => void>();
  const directed = match.onFrame;
  match.onFrame = (state, dt) => {
    directed?.(state, dt);
    for (const step of [...steps]) step(state, dt);
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

  /** The guide walks ahead over open floor, never far from the hero, and waits at `guide`. */
  const lead = async (to: Vec2, guide: Vec2) => {
    stage.goal(GOALS.follow);
    anchor = to;
    const walk = (async () => {
      for (const cell of route(d.state, cellOf(d.actor(LULU)), guide)) {
        if (!(await d.until((state) => near(state.players[0], cell, 4.5)))) return false;
        if (!(await d.walk(LULU, cell, 3.4))) return false;
      }
      return true;
    })();
    if (!(await d.until((state) => near(state.players[0], to, 1.3)))) return false;
    if (!(await walk)) return false;
    d.face(LULU, d.hero);
    stage.goal();
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
  stage.root.classList.add("ascend-bars");
  const loader = new THREE.TextureLoader();
  loader.load(ASCENSION_ART.sky, (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.mapping = THREE.EquirectangularReflectionMapping;
    keepSky(texture);
    renderer.paintSky(texture, SKY_TURN);
  });

  // The world breaks into blocks, the saxophone comes in, and for a moment it is a drawing.
  if (!(await d.until(() => shot.time >= ASCENSION_HIT - 0.05))) return;
  rolling = false;
  flash();
  stage.host.music("ascension");
  stage.host.cue("pull");
  stage.art(ASCENSION_ART.panel);
  stage.root.querySelector(".stage-art")?.classList.add("ascend-push");
  if (!(await stage.wait(PANEL_MS))) return;
  flash();
  stage.art();
  stage.root.querySelector(".story-art")?.classList.remove("ascend-push");
  // From here on the hero sees with his own eyes; the shot keeps the camera until it gets there.
  hero((p) => delete p.tacticalView);
  rolling = true;
  if (!(await d.until(() => shot.done))) return;
  renderer.stagedShot = undefined;
  stage.root.classList.remove("ascend-bars");

  if (!(await say(LINES.arrive))) return;
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
  match.hud = true;
  match.live = true;
  if (!(await say(LINES.look))) return;
  stage.goal(GOALS.look);
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

  if (!(await say(LINES.sprint))) return;
  allowed.add("sprint");
  stage.goal(GOALS.sprint);
  if (!(await d.until((state) => state.players[0].stamina < 12))) return;
  allowed.delete("sprint");
  if (!(await say(LINES.winded))) return;
  allowed.add("sprint").add("jump");
  stage.goal(GOALS.jump);
  const jump = async () =>
    (await d.until((state) => state.players[0].elevation > 0.35)) &&
    (await d.until((state) => state.players[0].elevation === 0));
  if (!(await jump())) return;
  if (!(await say(LINES.jumped))) return;
  stage.goal(GOALS.jumpAgain);
  if (!(await jump())) return;
  if (!(await say(LINES.jumpedAgain))) return;

  // --- 4.2 Gear ------------------------------------------------------------------------------

  void (async () => {
    for (const cell of route(d.state, cellOf(d.actor(LULU)), PLACE.crateGuide))
      if (!(await d.walk(LULU, cell, 3.4))) return;
    d.face(LULU, PLACE.crate);
  })();
  if (!(await say(LINES.hands))) return;
  allowed.add("equip").add("use");
  anchor = PLACE.crateFront;
  stage.goal(GOALS.knife);
  if (!(await d.until((state) => state.tiles[PLACE.crate.z][PLACE.crate.x] === 0))) return;
  if (!(await say(LINES.knifed))) return;

  if (!(await say(LINES.toWall))) return;
  if (!(await lead(PLACE.lane, PLACE.laneGuide))) return;
  give("grenade", 3);
  if (!(await say(LINES.grenade))) return;
  stage.goal(GOALS.grenade);
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

  give("molotov", 2);
  if (!(await say(LINES.molotov))) return;
  stage.goal(GOALS.molotov);
  if (!(await d.until((state) => state.fires.length > 0))) return;
  if (!(await d.seconds(0.8))) return;
  if (!(await say(LINES.molotovDone))) return;
  // Nobody learns anything standing in a fire: wait it out.
  if (!(await d.until((state) => !state.fires.length))) return;

  if (!(await say(LINES.shield))) return;
  stage.goal(GOALS.shield);
  for (;;) {
    give("shield", 1);
    hero((p) => {
      p.hp = p.maxHp;
      p.shield = 0;
    });
    if (!(await d.until((state) => state.players[0].shield > 0))) return;
    const raised = d.state.time;
    void d.talk(fill(LINES.shieldUp), { live: true });
    const here = cellOf(d.hero);
    const beside = [
      { x: here.x + 1, z: here.z },
      { x: here.x - 1, z: here.z },
      { x: here.x, z: here.z + 1 },
      { x: here.x, z: here.z - 1 },
    ].find((cell) => free(d.state, cell));
    const charge = plant(beside ?? here, 1.5);
    if (!(await detonated(charge))) return;
    stage.interrupt();
    const held = since(d.state, raised).some(
      (e) => (e.type === "shield-end" && e.reason === "broken") || (e.type === "hurt" && e.blocked),
    );
    if (held) break;
    if (!(await say(LINES.shieldRetry))) return;
  }
  if (!(await say(LINES.shieldDone))) return;
  // The aftershock: scripted, and survivable by exactly one bandage.
  stage.host.cue("blast");
  hero((p) => {
    p.hp = Math.min(p.hp, 22);
    p.shield = 0;
  });
  give("bandage", 1);
  if (!(await say(LINES.bleeding))) return;
  stage.goal(GOALS.bandage);
  if (!(await d.until((state) => state.players[0].hp > 22))) return;
  if (!(await say(LINES.bandaged))) return;

  hero((p) => (p.crates = 3));
  if (!(await say(LINES.build))) return;
  allowed.add("build");
  stage.goal(GOALS.build);
  const before = d.state.builtCrates?.length ?? 0;
  if (!(await d.until((state) => (state.builtCrates?.length ?? 0) > before))) return;
  const crate = d.state.builtCrates!.at(-1)!;
  if (!(await say(LINES.built))) return;
  {
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

  if (!(await say(LINES.toShop))) return;
  if (!(await lead(PLACE.shop, PLACE.shopGuide))) return;
  hero((p) => (p.credits = 60));
  for (;;) {
    if (!(await match.shop())) return;
    if (d.hero.skills.length) break;
    if (!(await say(LINES.shopEmpty))) return;
  }
  const skill = SKILLS[d.hero.skills[0]];
  allowed.add("skill");
  if (skill.passive) {
    if (!(await say(LINES.castPassive, { name: field(skill, "name") }))) return;
  } else {
    if (
      !(await say(LINES.cast, { skill: bindings.label(skillBinding(skill.id)), name: field(skill, "name") }))
    )
      return;
    stage.goal(GOALS.cast);
    const asked = d.state.time;
    if (!(await d.until((state) => since(state, asked).some((e) => e.type === "skill")))) return;
    if (!(await say(LINES.castDone))) return;
  }

  d.face(DUMMY, PLACE.shop);
  if (!(await say(LINES.target))) return;
  stage.goal(GOALS.target);
  if (!(await d.until((state) => !state.players.find((p) => p.id === DUMMY)?.alive))) return;
  // Felling it is worth a level whatever it was felled with.
  hero((p) => (p.xp = Math.max(p.xp, p.nextLevel)));
  if (!(await d.until((state) => state.players[0].offers.length > 0))) return;
  allowed.add("perk");
  if (!(await say(LINES.levelled))) return;
  stage.goal(GOALS.perk);
  if (!(await d.until((state) => !state.players[0].offers.length && state.players[0].perks.length > 0)))
    return;
  const perk = perkById(d.hero.perks.at(-1)!);
  if (!(await say(LINES.perk, { name: perk ? field(perk, "name") : "强化" }))) return;
  reachCheckpoint("act4-skill", { act4Skill: skill.id, act4Perk: perk?.id ?? "" });

  // --- 4.4 The ones who did not clear the game -----------------------------------------------

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
  d.lock(true);
  hero((p, state) => {
    p.hp = p.maxHp;
    p.invulnerableUntil = state.time + 3;
  });
  rise(open[0] ?? PLACE.risen[0], 1);
  rise(open[1] ?? PLACE.risen[1], 1);
  if (!(await d.seconds(1.3))) return;
  stage.art(ASCENSION_ART.risen);
  if (!(await d.talk(fill(LINES.risen)))) return;
  stage.art();
  if (!(await d.talk(fill(LINES.fight)))) return;
  d.lock(false);
  anchor = PLACE.gravesGuide;
  stage.goal(GOALS.zombies);
  if (!(await d.until((state) => state.zombies.length < 2))) return;
  rise(open[2] ?? open[0] ?? PLACE.risen[2], 3, true);
  if (!(await d.seconds(1.3))) return;
  if (!(await d.talk(fill(LINES.mutant)))) return;
  const fought = d.state.time;
  if (!(await d.until((state) => !state.zombies.length))) return;
  stage.goal();
  if (!(await d.seconds(1))) return;
  if (since(d.state, fought).some((e) => e.type === "mutation") && !(await say(LINES.mutated))) return;
  d.lock(true);
  stage.end("act4-done");
}
