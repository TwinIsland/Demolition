import kaplay from "kaplay";
import type { Room } from "../room";
import { VIEW, type Hotspot } from "../script";
import { facingOf, HEADING, loadZeroSprite, type Facing } from "../zero-sprite";
import type { Box, Prop, PropChange, RpgMap } from "./map";

/** Pixels per second. */
const WALK_SPEED = 58;
/** The feet: what collides. The walker's position is the bottom centre of the sprite. */
const FEET = { halfWidth: 4, height: 4 };
/** How far from the feet something can be examined, unless the prop says otherwise. */
const REACH = 12;
/** How much closer something counts for being in front of the walker. */
const AHEAD_BONUS = 8;
/** Draw order: ground, things on it, everything sorted by foot line, covers, light. */
const Z = { floor: 1, wall: 2, shaft: 3, sorted: 10, above: 10_000, glow: 10_001 };
/** Sunlight on the floor, and the little of it that reaches whoever stands in it. */
const SHAFT_OPACITY = { floor: 0.24, over: 0.07 };
const PANE_GAP = 2;

interface Live {
  prop: Prop;
  hidden: boolean;
  /** Absolute rectangles. */
  box?: Box;
  touch: Box;
  hotspot?: Hotspot;
  loop?: PropChange["loop"];
  show(visible: boolean): void;
  frame(index: number): void;
  /** Per-frame motion and blinking, at the room's clock. */
  tick?(time: number): void;
}

const placed = (prop: Prop, box: Box): Box => ({ x: prop.x + box.x, y: prop.y + box.y, w: box.w, h: box.h });

/**
 * Runs a tile-and-prop room on `canvas` with Kaplay. The ground grid and each prop's foot box say
 * where the walker fits; props and the walker are drawn in order of their foot lines, so he passes
 * behind a wardrobe and in front of it. `onFacing` reports the hotspot in reach when it changes.
 */
export function openWorld(
  canvas: HTMLCanvasElement,
  map: RpgMap,
  hotspotList: readonly Hotspot[],
  onFacing: (hotspot: Hotspot | undefined) => void,
): Room {
  const k = kaplay({
    canvas,
    width: VIEW.width,
    height: VIEW.height,
    stretch: true,
    crisp: true,
    global: false,
    background: "#0b0a14",
    loadingScreen: false,
    touchToMouse: false,
    focus: false,
  });
  const { tile, rows } = map;
  const width = rows[0].length * tile,
    height = rows.length * tile;
  const tint = map.tint ?? [255, 255, 255];
  const lit = k.rgb(tint[0], tint[1], tint[2]);
  /** A flat colour as it looks at this time of day. */
  const shade = (hex: string) => {
    const value = Number.parseInt(hex.slice(1), 16);
    return k.rgb(
      (((value >> 16) & 255) * tint[0]) / 255,
      (((value >> 8) & 255) * tint[1]) / 255,
      ((value & 255) * tint[2]) / 255,
    );
  };
  const solidAt = (x: number, y: number) =>
    map.tiles[rows[Math.floor(y / tile)]?.[Math.floor(x / tile)] ?? ""]?.solid ?? true;

  // The ground is painted once, cell by cell, and drawn as one picture.
  const paintGround = (sheet?: HTMLImageElement) => {
    const ground = document.createElement("canvas");
    ground.width = width;
    ground.height = height;
    const ink = ground.getContext("2d")!;
    rows.forEach((row, z) =>
      [...row].forEach((symbol, x) => {
        const cell = map.tiles[symbol];
        if (!cell) return;
        const overFloor = cell.solid && map.tiles[rows[z + 1]?.[x] ?? ""]?.solid === false;
        const column =
          overFloor && cell.skirt !== undefined ? cell.skirt : cell.art?.[(x * 3 + z * 5) % cell.art.length];
        if (sheet && column !== undefined)
          ink.drawImage(sheet, column * tile, 0, tile, tile, x * tile, z * tile, tile, tile);
        else {
          ink.fillStyle = cell.color;
          ink.fillRect(x * tile, z * tile, tile, tile);
        }
      }),
    );
    k.loadSprite("ground", ground);
    k.add([k.sprite("ground"), k.pos(0, 0), k.color(lit), k.z(0)]);
  };
  if (map.tileSheet) {
    // Decoded on the loading screen already, so this is a frame at most.
    const sheet = new Image();
    sheet.onload = () => paintGround(sheet);
    sheet.onerror = () => paintGround();
    sheet.src = map.tileSheet;
  } else paintGround();

  const hotspots = new Map(hotspotList.map((hotspot) => [hotspot.id, hotspot]));
  const lives = new Map<string, Live>();
  for (const prop of map.props) {
    const z = prop.layer === "sorted" ? Z.sorted + (prop.sortY ?? prop.y + prop.h) : Z[prop.layer];
    const base = [k.pos(prop.x, prop.y), k.z(z), k.opacity(prop.opacity ?? 1)] as const;
    let frame: Live["frame"] = () => {};
    let object;
    if (prop.art) {
      const name = `prop-${prop.id}`;
      k.loadSprite(name, prop.art, { sliceX: prop.frames?.columns ?? 1, sliceY: prop.frames?.rows ?? 1 });
      const sprite = k.add([k.sprite(name), k.color(lit), ...base]);
      frame = (index) => (sprite.frame = index);
      object = sprite;
    } else if (prop.color) object = k.add([k.rect(prop.w, prop.h), k.color(shade(prop.color)), ...base]);
    const shown = object;
    const { blink, motion } = prop;
    const tick =
      shown && (blink || motion)
        ? (time: number) => {
            if (blink) shown.opacity = time % blink < blink / 2 ? (prop.opacity ?? 1) : 0;
            if (motion?.kind === "bob")
              shown.pos.y =
                prop.y + Math.round(Math.sin((time / motion.period) * Math.PI * 2) * motion.amount);
            if (motion?.kind === "shake")
              shown.pos.x = prop.x + (Math.floor(time / motion.period) % 2 ? motion.amount : 0);
          }
        : undefined;
    const box = prop.box && placed(prop, prop.box);
    const live: Live = {
      prop,
      hidden: !!prop.hidden,
      box,
      touch: prop.touch ? placed(prop, prop.touch) : (box ?? { x: prop.x, y: prop.y, w: prop.w, h: prop.h }),
      hotspot: hotspots.get(prop.hotspot ?? prop.id),
      loop: prop.loop,
      show: (visible) => {
        if (shown) shown.hidden = !visible;
      },
      frame,
      tick,
    };
    live.show(!live.hidden);
    lives.set(prop.id, live);
  }
  const glows = (map.glows ?? []).flatMap((glow) =>
    (
      [
        [1, 0.07],
        [0.66, 0.08],
        [0.36, 0.1],
      ] as const
    ).map(([scale, opacity]) => ({
      glow,
      opacity,
      ring: k.add([
        k.circle(glow.radius * scale),
        k.pos(glow.x, glow.y),
        k.color(k.Color.fromHex(glow.color)),
        k.opacity(opacity),
        k.z(Z.glow),
      ]),
    })),
  );

  // Each pane of a window is a slanted patch on the floor. Furniture is drawn over the bright
  // patch and so blocks it; a faint second copy on top tints whoever walks into the light.
  const panes = (map.shafts ?? []).flatMap((shaft) => {
    const wide = shaft.w / shaft.columns,
      deep = shaft.h / shaft.rows;
    const lean = (depth: number) => (shaft.shear * depth) / shaft.h;
    const patches = [];
    for (let row = 0; row < shaft.rows; row++)
      for (let column = 0; column < shaft.columns; column++) {
        const near = row * deep + PANE_GAP,
          far = (row + 1) * deep,
          left = column * wide + PANE_GAP,
          right = (column + 1) * wide;
        const outline = [
          k.vec2(Math.round(left + lean(near)), near),
          k.vec2(Math.round(right + lean(near)), near),
          k.vec2(Math.round(right + lean(far)), far),
          k.vec2(Math.round(left + lean(far)), far),
        ];
        for (const [z, opacity] of [
          [Z.shaft, SHAFT_OPACITY.floor],
          [Z.glow, SHAFT_OPACITY.over],
        ] as const)
          patches.push({
            opacity,
            patch: k.add([
              k.polygon(outline),
              k.pos(shaft.x, shaft.y),
              k.color(k.Color.fromHex(shaft.color)),
              k.opacity(opacity),
              k.z(z),
            ]),
          });
      }
    return patches;
  });

  loadZeroSprite(k);
  const zero = k.add([
    k.sprite("zero", { anim: "idle-down" }),
    k.pos(map.spawn.x, map.spawn.y),
    k.anchor("bot"),
    k.z(Z.sorted + map.spawn.y),
  ]);

  const fits = (x: number, y: number) => {
    const left = x - FEET.halfWidth,
      right = x + FEET.halfWidth,
      top = y - FEET.height;
    if (
      solidAt(left, top) ||
      solidAt(right - 0.01, top) ||
      solidAt(left, y - 0.01) ||
      solidAt(right - 0.01, y - 0.01)
    )
      return false;
    for (const { hidden, box } of lives.values())
      if (!hidden && box && left < box.x + box.w && right > box.x && top < box.y + box.h && y > box.y)
        return false;
    return true;
  };
  const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
  /** The view follows the walker and stops at the edges of the map. */
  const follow = () =>
    k.setCamPos(
      Math.round(clamp(zero.pos.x, VIEW.width / 2, Math.max(VIEW.width / 2, width - VIEW.width / 2))),
      Math.round(
        clamp(zero.pos.y - 16, VIEW.height / 2, Math.max(VIEW.height / 2, height - VIEW.height / 2)),
      ),
    );
  follow();

  let heading: Facing = "down",
    walking = false,
    intent: readonly [number, number] = [0, 0],
    facing: Hotspot | undefined,
    clock = 0,
    closed = false;
  const room: Room = {
    frozen: true,
    move: (x, y) => (intent = [x, y]),
    get facing() {
      return facing;
    },
    get paused() {
      return k.debug.paused;
    },
    set paused(value) {
      k.debug.paused = value;
    },
    set(id, change) {
      const live = lives.get(id);
      if (!live) return;
      if (change.hidden !== undefined) live.show(!(live.hidden = change.hidden));
      if (change.frame !== undefined) {
        live.loop = undefined;
        live.frame(change.frame);
      }
      if (change.loop) live.loop = change.loop;
    },
    dispose: () => {
      closed = true;
      k.quit();
    },
  };

  k.onUpdate(() => {
    // Kaplay only quits at the end of its next frame, and by then its camera belongs to whichever
    // scene opened after this one: a closed room must not move it.
    if (closed) return;
    clock += k.dt();
    const [mx, my] = room.frozen ? [0, 0] : intent;
    const length = Math.hypot(mx, my);
    if (length) {
      const step = (WALK_SPEED * Math.min(k.dt(), 0.05)) / length;
      // Axes move separately, so the walker slides along furniture instead of sticking to it.
      if (mx && fits(zero.pos.x + mx * step, zero.pos.y)) zero.pos.x += mx * step;
      if (my && fits(zero.pos.x, zero.pos.y + my * step)) zero.pos.y += my * step;
      heading = facingOf(mx, my, heading);
    }
    const anim = `${length ? "walk" : "idle"}-${heading}`;
    if (zero.curAnim() !== anim || walking !== !!length) zero.play(anim);
    walking = !!length;
    zero.z = Z.sorted + zero.pos.y;
    follow();
    for (const live of lives.values()) {
      if (live.loop)
        live.frame(
          live.loop.from + (Math.floor(clock * live.loop.fps) % (live.loop.to - live.loop.from + 1)),
        );
      live.tick?.(clock);
    }
    // Sunlight breathes slowly, as if a cloud were thinking about it.
    for (const { opacity, patch } of panes) patch.opacity = opacity * (1 + 0.12 * Math.sin(clock * 0.7));
    // Two slow waves out of step: a lamp that wavers without a visible rhythm.
    for (const { glow, opacity, ring } of glows)
      if (glow.flicker)
        ring.opacity =
          opacity *
          (1 + glow.flicker * 0.5 * (Math.sin(clock * 5.3 + glow.x) + Math.sin(clock * 2.1 + glow.y)));

    // The nearest thing in reach is examined; what the walker faces counts as nearer.
    const [hx, hy] = HEADING[heading];
    const fx = zero.pos.x,
      fy = zero.pos.y - FEET.height / 2;
    let best = Infinity,
      target: Hotspot | undefined;
    for (const { hidden, hotspot, touch, prop } of lives.values()) {
      if (hidden || !hotspot) continue;
      const dx = clamp(fx, touch.x, touch.x + touch.w) - fx,
        dy = clamp(fy, touch.y, touch.y + touch.h) - fy;
      const distance = Math.hypot(dx, dy);
      if (distance > (prop.reach ?? REACH)) continue;
      const ahead = distance > 0 && (dx * hx + dy * hy) / distance > 0.5;
      const score = distance - (ahead ? AHEAD_BONUS : 0);
      if (score < best) {
        best = score;
        target = hotspot;
      }
    }
    if (target !== facing) onFacing((facing = target));
  });
  return room;
}
