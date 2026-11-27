import kaplay from "kaplay";
import { STORY_ART } from "./assets";
import { playPullIn, type PullIn } from "./pull-in";
import { ARCADE_VIEW, type ArcadeScene, type Line } from "./script";
import type { ScenePlayer, Stage } from "./stage";
import { FACINGS, type Facing } from "./zero-sprite";

const CELL = 16;
/** Seconds from placing a bubble to its blast, and how long the blast stays deadly. */
const FUSE = 3;
const BLAST_TIME = 0.45;
/** Seconds a fallen player waits, and is then safe for. */
const RESPAWN = 1.1;
const SHIELD = 2;
/** Cells per second. */
const PLAYER_SPEED = 4.2;
const CPU_SPEED = 2.8;
/** Seconds before the opponent notices a bubble that is not its own. It gets slower as the duel drags on. */
const CPU_REACTION = 1.2;
const CPU_TIRED_AFTER = 45;
const CPU_TIRED_REACTION = 2.1;
const CPU_BOMB_COOLDOWN = 2.4;
const CAPS = { speed: PLAYER_SPEED * 1.5, range: 4, capacity: 3 };

/** The players' sheet: per row, three walk frames for each facing, a victory pose, and the trapped pose. */
const CAST = ["zero", "rival"] as const;
const CHIBI = { columns: 14, facings: ["down", "left", "right", "up"] as readonly Facing[], win: 12, ko: 13 };
/** The sheet's frames are 32 px with the soles two pixels above the bottom edge. */
const FEET_Y = 9;

/** Frames of the "arcade" sheet (tools/story/make-arcade.py). */
const FRAME = {
  grass: 0,
  checker: 1,
  pillar: 2,
  crate: 3,
  gift: 4,
  centre: 8,
  arm: 9,
  cap: 10,
  shoe: 11,
  range: 12,
  extra: 13,
} as const;
type Pickup = "shoe" | "range" | "extra";
const DIRS = [
  { x: 1, y: 0, angle: 0, facing: "right" },
  { x: 0, y: 1, angle: 90, facing: "down" },
  { x: -1, y: 0, angle: 180, facing: "left" },
  { x: 0, y: -1, angle: 270, facing: "up" },
] as const;
type Cell = readonly [number, number];
type Phase = "intro" | "first" | "chant" | "crates" | "entrance" | "duel" | "outro";

/**
 * Plays the bubble game of act 2 on the old computer's screen: a first bubble that ends badly,
 * a few crates, a duel with a slow computer player, and then the power cut. Kaplay draws; the
 * board is the scene's layout, changed as crates break.
 */
export function playArcade(stage: Stage, scene: ArcadeScene): ScenePlayer {
  const k = kaplay({
    canvas: stage.canvas,
    width: ARCADE_VIEW.width,
    height: ARCADE_VIEW.height,
    stretch: true,
    crisp: true,
    global: false,
    background: "#05060c",
    loadingScreen: false,
    touchToMouse: false,
    focus: false,
  });
  const rows = scene.layout.map((row) => [...row]);
  const width = rows[0].length,
    left = (ARCADE_VIEW.width - width * CELL) / 2,
    top = (ARCADE_VIEW.height - rows.length * CELL) / 2;
  const px = (x: number) => left + (x + 0.5) * CELL,
    py = (y: number) => top + (y + 0.5) * CELL,
    key = (x: number, y: number) => y * width + x;
  const corner = (symbol: string): Cell => {
    const y = rows.findIndex((row) => row.includes(symbol)),
      x = rows[y].indexOf(symbol);
    rows[y][x] = ".";
    return [x, y];
  };
  const playerCorner = corner("@"),
    cpuCorner = corner("E");

  k.loadSprite("arcade", STORY_ART.arcade, {
    sliceX: 8,
    sliceY: 2,
    anims: { bubble: { from: 5, to: 7, loop: true, pingpong: true, speed: 6 } },
  });
  // Both players come from one sheet: a row each, cut by tools/story/make-chibi.py.
  k.loadSprite("chibi", STORY_ART.chibi, {
    sliceX: CHIBI.columns,
    sliceY: CAST.length,
    anims: Object.fromEntries(
      CAST.flatMap((who, row) => {
        const first = row * CHIBI.columns;
        return [
          ...FACINGS.flatMap((facing) => {
            const at = first + CHIBI.facings.indexOf(facing) * 3;
            return [
              [`${who}-idle-${facing}`, at],
              [`${who}-walk-${facing}`, { from: at + 1, to: at + 2, loop: true, speed: 7 }],
            ];
          }),
          [`${who}-win`, first + CHIBI.win],
          [`${who}-ko`, first + CHIBI.ko],
        ];
      }),
    ),
  });
  const tile = (frame: number, x: number, y: number, z = 0, angle = 0) =>
    k.add([k.sprite("arcade", { frame }), k.pos(px(x), py(y)), k.anchor("center"), k.rotate(angle), k.z(z)]);
  type Tile = ReturnType<typeof tile>;
  const crates = new Map<number, Tile>();
  rows.forEach((row, y) =>
    row.forEach((symbol, x) => {
      tile((x + y) % 2 ? FRAME.checker : FRAME.grass, x, y);
      if (symbol === "#") tile(FRAME.pillar, x, y, 1);
      else if (symbol === "c" || symbol === "g") {
        crates.set(key(x, y), tile(symbol === "g" ? FRAME.gift : FRAME.crate, x, y, 1));
        row[x] = "c";
      }
    }),
  );

  const walker = ([x, y]: Cell, cast: (typeof CAST)[number]) => ({
    cast,
    obj: k.add([
      k.sprite("chibi", { anim: `${cast}-idle-down` }),
      k.pos(px(x), py(y) + FEET_Y),
      k.anchor("bot"),
      k.opacity(1),
      k.z(10),
    ]),
    spawn: [x, y] as Cell,
    x,
    y,
    heading: "down" as Facing,
    moving: false,
    alive: true,
    shield: 0,
    speed: PLAYER_SPEED,
    range: 2,
    capacity: 1,
    /** Bubbles of this walker still on the board. */
    out: 0,
  });
  type Walker = ReturnType<typeof walker>;
  const player = walker(playerCorner, "zero");
  let cpu: Walker | undefined;
  const walkers = () => (cpu ? [player, cpu] : [player]);
  const cellOf = (who: Walker): Cell => [Math.round(who.x), Math.round(who.y)];

  interface Bubble {
    x: number;
    y: number;
    fuse: number;
    age: number;
    owner: Walker;
    obj: Tile;
    /** Walkers still standing where it was placed, who may walk off it. */
    passers: Set<Walker>;
  }
  const bubbles = new Map<number, Bubble>();
  const flames: { key: number; until: number; obj: Tile }[] = [];
  const pickups = new Map<number, { kind: Pickup; obj: Tile }>();

  let phase: Phase = "intro",
    frozen = true,
    over = false,
    alive = true,
    locked = false,
    clock = 0,
    broken = 0,
    drops = 0,
    shoeTold = false,
    intent: Cell = [0, 0],
    cutscene: PullIn | undefined;
  /** Conversations that hold the game wait their turn, so two events never share the text box. */
  let queue: Promise<boolean> = Promise.resolve(true);
  const say = (lines: readonly Line[]) => (queue = queue.then((ok) => ok && stage.talk(lines)));

  const blocked = (who: Walker, x: number, y: number) => {
    if (rows[y]?.[x] !== ".") return true;
    const bubble = bubbles.get(key(x, y));
    return !!bubble && !bubble.passers.has(who);
  };
  /**
   * Walks `distance` cells along one axis. A walker between two lanes is first slid onto the
   * nearer one, so corners do not need pixel-perfect timing. False when there is a wall ahead.
   */
  const walk = (who: Walker, dx: number, dy: number, distance: number) => {
    const along = dx ? "x" : "y",
      across = dx ? "y" : "x",
      dir = dx || dy;
    const lane = Math.round(who[across]),
      base = Math.round(who[along]);
    const free = dx ? !blocked(who, base + dir, lane) : !blocked(who, lane, base + dir);
    const room = free ? Infinity : Math.max(0, (base - who[along]) * dir);
    if (room < 1e-4) return false;
    const off = lane - who[across];
    const slide = Math.min(distance, Math.abs(off));
    who[across] += Math.sign(off) * slide;
    who[along] += dir * Math.min(distance - slide, room);
    who.heading = DIRS.find((d) => d.x === dx && d.y === dy)!.facing;
    return true;
  };

  /** Cells a bubble at (x, y) reaches: its own, and each arm up to the first pillar or crate. */
  const cross = (x: number, y: number, range: number) => {
    const cells: Cell[] = [[x, y]];
    for (const dir of DIRS)
      for (let i = 1; i <= range; i++) {
        const cx = x + dir.x * i,
          cy = y + dir.y * i;
        if (rows[cy]?.[cx] !== ".") break;
        cells.push([cx, cy]);
      }
    return cells;
  };
  const burning = (x: number, y: number) => flames.some((flame) => flame.key === key(x, y));

  const place = (who: Walker) => {
    const [x, y] = cellOf(who);
    if (who.out >= who.capacity || bubbles.has(key(x, y))) return false;
    who.out++;
    bubbles.set(key(x, y), {
      x,
      y,
      fuse: FUSE,
      age: 0,
      owner: who,
      obj: k.add([
        k.sprite("arcade", { anim: "bubble" }),
        k.pos(px(x), py(y)),
        k.anchor("center"),
        k.rotate(0),
        k.z(2),
      ]),
      passers: new Set(walkers().filter((other) => other.alive && key(...cellOf(other)) === key(x, y))),
    });
    stage.host.cue("place");
    return true;
  };

  const drop = (x: number, y: number) => {
    // The first crate always holds the shoe the story talks about; after that, one in three.
    const kind: Pickup | undefined =
      broken === 1 ? "shoe" : broken % 3 === 0 ? (drops % 2 ? "range" : "extra") : undefined;
    if (!kind) return;
    drops++;
    pickups.set(key(x, y), { kind, obj: tile(FRAME[kind], x, y, 2) });
  };
  const flame = (frame: number, x: number, y: number, angle = 0) =>
    flames.push({ key: key(x, y), until: clock + BLAST_TIME, obj: tile(frame, x, y, 3, angle) });
  const explode = (bubble: Bubble) => {
    bubbles.delete(key(bubble.x, bubble.y));
    bubble.obj.destroy();
    bubble.owner.out--;
    stage.host.cue("blast");
    flame(FRAME.centre, bubble.x, bubble.y);
    const range = bubble.owner.range;
    for (const dir of DIRS)
      for (let i = 1; i <= range; i++) {
        const x = bubble.x + dir.x * i,
          y = bubble.y + dir.y * i,
          symbol = rows[y]?.[x];
        if (symbol === "c") {
          rows[y][x] = ".";
          crates.get(key(x, y))?.destroy();
          crates.delete(key(x, y));
          flame(FRAME.cap, x, y, dir.angle);
          broken++;
          drop(x, y);
          crateBroken();
        }
        if (symbol !== ".") break;
        const next = bubbles.get(key(x, y));
        if (next) next.fuse = Math.min(next.fuse, 0.06);
        flame(i === range ? FRAME.cap : FRAME.arm, x, y, dir.angle);
      }
  };

  const respawn = (who: Walker) => {
    [who.x, who.y] = who.spawn;
    who.alive = true;
    who.shield = SHIELD;
    bubbles.get(key(...who.spawn))?.passers.add(who);
  };
  const showCrateGoal = () =>
    stage.goal(`${scene.goals.crates} ${Math.min(broken, scene.crateGoal)}/${scene.crateGoal}`);

  const afterChant = async () => {
    stage.interrupt();
    if (!(await stage.wait(900))) return;
    if (!(await say([...scene.lines.chantFailed, ...scene.lines.warmup]))) return;
    respawn(player);
    locked = false;
    broken = 0;
    phase = "crates";
    showCrateGoal();
  };
  const entrance = async () => {
    if (!(await stage.wait(700))) return;
    if (!(await say(scene.lines.duel))) return;
    cpu = walker(cpuCorner, "rival");
    cpu.speed = CPU_SPEED;
    duelStart = clock;
    phase = "duel";
    stage.goal(scene.goals.duel);
  };
  const outro = async () => {
    stage.goal();
    if (!(await stage.wait(900))) return;
    if (!(await say(scene.lines.curfew))) return;
    over = frozen = true;
    stage.host.silence();
    stage.host.cue("power");
    stage.root.classList.add("blackout");
    if (!(await stage.wait(1400))) return;
    if (!(await say(scene.lines.blackout))) return;
    stage.root.classList.add("pulling");
    if (!(await say(scene.lines.pulled))) return;
    stage.host.cue("pull");
    cutscene = playPullIn(stage.overlay());
    await cutscene.done;
    if (!alive) return;
    stage.art(scene.goneArt);
    if (!(await say(scene.lines.gone))) return;
    stage.end(scene.checkpoint);
  };

  function crateBroken() {
    if (phase !== "crates") return;
    showCrateGoal();
    if (broken < scene.crateGoal) return;
    phase = "entrance";
    void entrance();
  }
  const fall = (who: Walker) => {
    who.alive = false;
    stage.host.cue("down");
    if (who === cpu) {
      phase = "outro";
      void outro();
    } else if (phase === "chant") void afterChant();
    else
      void stage.wait(RESPAWN * 1000).then((ok) => {
        if (ok && !who.alive) respawn(who);
      });
  };

  /** Shortest way from `start` to a cell `goal` accepts, without the start itself. */
  const route = (start: Cell, goal: (x: number, y: number) => boolean, avoid?: Map<number, number>) => {
    const from = new Map<number, Cell | undefined>([[key(...start), undefined]]);
    const open: Cell[] = [start];
    for (let head = 0; head < open.length; head++) {
      const [x, y] = open[head];
      if (goal(x, y) && head > 0) {
        const path: Cell[] = [];
        for (let at: Cell | undefined = open[head]; at && from.get(key(...at)); at = from.get(key(...at)))
          path.unshift(at);
        return path;
      }
      for (const dir of DIRS) {
        const nx = x + dir.x,
          ny = y + dir.y,
          id = key(nx, ny);
        if (from.has(id) || rows[ny]?.[nx] !== "." || bubbles.has(id) || burning(nx, ny) || avoid?.has(id))
          continue;
        from.set(id, [x, y]);
        open.push([nx, ny]);
      }
    }
    return undefined;
  };

  let duelStart = 0,
    cpuTarget: Cell | undefined,
    cpuPause = 0,
    cpuCooldown = 1.5;
  /** Picks the opponent's next cell: out of danger first, then a bubble if it is worth one, then closer. */
  const think = (me: Walker) => {
    const here = cellOf(me),
      target = cellOf(player);
    const reaction = clock - duelStart > CPU_TIRED_AFTER ? CPU_TIRED_REACTION : CPU_REACTION;
    const danger = new Map<number, number>();
    for (const bubble of bubbles.values())
      if (bubble.owner === me || bubble.age >= reaction)
        for (const [x, y] of cross(bubble.x, bubble.y, bubble.owner.range))
          danger.set(key(x, y), bubble.fuse);
    const safe = (x: number, y: number) => !danger.has(key(x, y));
    if (!safe(...here) || burning(...here)) return route(here, safe)?.[0];

    const mine = cross(here[0], here[1], me.range);
    const inLine = player.alive && mine.some(([x, y]) => x === target[0] && y === target[1]);
    const approach = player.alive
      ? route(here, (x, y) => x === target[0] && y === target[1], danger)
      : undefined;
    const crateNear = DIRS.some((dir) => rows[here[1] + dir.y]?.[here[0] + dir.x] === "c");
    if (me.out < me.capacity && cpuCooldown <= 0 && (inLine || (crateNear && !approach))) {
      const after = new Map(danger);
      for (const [x, y] of mine) after.set(key(x, y), FUSE);
      const escape = route(here, (x, y) => !after.has(key(x, y)));
      if (escape && escape.length <= 4 && place(me)) {
        cpuCooldown = CPU_BOMB_COOLDOWN;
        return escape[0];
      }
    }
    if (approach) return approach.length > 1 ? approach[0] : undefined;
    // Walled in: go and stand next to the crate nearest the player.
    let best: Cell | undefined,
      bestGap = Infinity;
    const gap = (x: number, y: number) => Math.abs(x - target[0]) + Math.abs(y - target[1]);
    route(
      here,
      (x, y) => {
        if (gap(x, y) < bestGap && DIRS.some((dir) => rows[y + dir.y]?.[x + dir.x] === "c")) {
          bestGap = gap(x, y);
          best = [x, y];
        }
        return false;
      },
      danger,
    );
    const goal = best as Cell | undefined;
    if (!goal || (crateNear && gap(...here) <= bestGap)) return undefined;
    return route(here, (x, y) => x === goal[0] && y === goal[1], danger)?.[0];
  };
  const steerCpu = (me: Walker, dt: number) => {
    cpuCooldown -= dt;
    me.moving = false;
    if ((cpuPause -= dt) > 0) return;
    if (!cpuTarget || (Math.abs(me.x - cpuTarget[0]) < 0.02 && Math.abs(me.y - cpuTarget[1]) < 0.02)) {
      if (cpuTarget) [me.x, me.y] = cpuTarget;
      cpuTarget = think(me);
      if (!cpuTarget) cpuPause = 0.2;
    }
    if (!cpuTarget) return;
    const dx = Math.sign(Math.round((cpuTarget[0] - me.x) * 50)),
      dy = dx ? 0 : Math.sign(Math.round((cpuTarget[1] - me.y) * 50));
    const gap = Math.abs(cpuTarget[0] - me.x) + Math.abs(cpuTarget[1] - me.y);
    me.moving = (!!dx || !!dy) && walk(me, dx, dy, Math.min(me.speed * dt, gap));
    if (!me.moving) cpuTarget = undefined;
  };

  const steerPlayer = (dt: number) => {
    const [mx, my] = locked || !player.alive ? [0, 0] : intent;
    const distance = player.speed * dt;
    // With two keys held, the turn comes first: that is what rounds a corner.
    const sideways = player.heading === "up" || player.heading === "down";
    const first = sideways ? ([mx, 0] as const) : ([0, my] as const),
      second = sideways ? ([0, my] as const) : ([mx, 0] as const);
    player.moving =
      ((first[0] || first[1]) && walk(player, first[0], first[1], distance)) ||
      ((second[0] || second[1]) && walk(player, second[0], second[1], distance)) ||
      false;
  };

  const take = (kind: Pickup) => {
    stage.host.cue("pickup");
    if (kind === "shoe") player.speed = Math.min(CAPS.speed, player.speed * 1.22);
    else if (kind === "range") player.range = Math.min(CAPS.range, player.range + 1);
    else player.capacity = Math.min(CAPS.capacity, player.capacity + 1);
    if (kind === "shoe" && !shoeTold) {
      shoeTold = true;
      void say(scene.lines.shoe);
    }
  };

  k.onUpdate(() => {
    const dt = Math.min(k.dt(), 0.1);
    if (!frozen) {
      clock += dt;
      steerPlayer(dt);
      if (cpu?.alive && phase === "duel") steerCpu(cpu, dt);
      for (const bubble of [...bubbles.values()]) {
        bubble.age += dt;
        bubble.fuse -= dt;
        for (const who of bubble.passers)
          if (!who.alive || key(...cellOf(who)) !== key(bubble.x, bubble.y)) bubble.passers.delete(who);
      }
      // A blast may set off its neighbours, whose fuse then runs out on the next pass.
      for (const bubble of [...bubbles.values()])
        if (bubble.fuse <= 0 && bubbles.has(key(bubble.x, bubble.y))) explode(bubble);
      for (let i = flames.length - 1; i >= 0; i--)
        if (flames[i].until <= clock) {
          flames[i].obj.destroy();
          flames.splice(i, 1);
        }
      for (const who of walkers()) {
        who.shield = Math.max(0, who.shield - dt);
        if (who.alive && !who.shield && phase !== "outro" && burning(...cellOf(who))) fall(who);
      }
      const found = player.alive ? pickups.get(key(...cellOf(player))) : undefined;
      if (found) {
        pickups.delete(key(...cellOf(player)));
        found.obj.destroy();
        take(found.kind);
      }
    }
    for (const who of walkers()) {
      who.obj.pos.x = px(who.x);
      who.obj.pos.y = py(who.y) + FEET_Y;
      who.obj.z = 10 + who.y;
      // A fallen player is simply gone; the one left standing cheers.
      who.obj.opacity = !who.alive ? 0 : who.shield && Math.floor(clock * 12) % 2 ? 0.3 : 1;
      const pose = !who.alive
        ? "ko"
        : cpu && !cpu.alive
          ? "win"
          : `${who.moving && !frozen ? "walk" : "idle"}-${who.heading}`;
      const anim = `${who.cast}-${pose}`;
      if (who.obj.curAnim() !== anim) who.obj.play(anim);
    }
  });

  void say(scene.lines.start).then((ok) => {
    if (!ok) return;
    phase = "first";
    stage.goal(scene.goals.first);
  });

  return {
    get frozen() {
      return frozen;
    },
    set frozen(value) {
      frozen = value || over;
    },
    move: (x, y) => (intent = [x, y]),
    act: () => {
      if (frozen || locked || !player.alive || !place(player) || phase !== "first") return;
      // The chant is far longer than the fuse, and nobody moves while chanting.
      phase = "chant";
      locked = true;
      stage.goal();
      void stage.talk(scene.lines.chant, { live: true });
    },
    get paused() {
      return k.debug.paused;
    },
    set paused(value) {
      k.debug.paused = value;
    },
    dispose: () => {
      alive = false;
      cutscene?.dispose();
      k.quit();
    },
  };
}
