import kaplay from "kaplay";
import { VIEW, type Hotspot, type RoomScene } from "./script";
import { facingOf, HEADING, loadZeroSprite, type Facing } from "./zero-sprite";

/** Pixels per second. */
const WALK_SPEED = 58;
/** The feet: what collides with furniture. Positions are the bottom centre of the sprite. */
const FEET = { halfWidth: 4, height: 4 };
/** How far in front of the feet the player can examine. */
const REACH = 7;
export interface Room {
  /** Walking direction; (0, 0) stands still. Ignored while `frozen`. */
  move(x: number, y: number): void;
  frozen: boolean;
  /** The reachable hotspot, in front or within its optional proximity radius. */
  readonly facing: Hotspot | undefined;
  /** Stops the room's clock while set. */
  paused: boolean;
  dispose(): void;
}

/**
 * Runs a walkable 8-bit room on `canvas` with Kaplay. Kaplay draws and animates; where the player
 * can stand is a lookup in the scene's layout. `onFacing` reports the hotspot in reach whenever
 * it changes.
 */
export function openRoom(
  canvas: HTMLCanvasElement,
  scene: RoomScene,
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
  const rows = scene.layout,
    cell = scene.cell,
    top = Math.floor((VIEW.height - rows.length * cell) / 2),
    left = Math.floor((VIEW.width - rows[0].length * cell) / 2);
  const symbolAt = (x: number, y: number) =>
    rows[Math.floor((y - top) / cell)]?.[Math.floor((x - left) / cell)] ?? "#";
  const open = `.@${scene.walkOver ?? ""}`;
  const walkable = (x: number, y: number) => open.includes(symbolAt(x, y));
  const fits = (x: number, y: number) =>
    walkable(x - FEET.halfWidth, y) &&
    walkable(x + FEET.halfWidth, y) &&
    walkable(x - FEET.halfWidth, y - FEET.height) &&
    walkable(x + FEET.halfWidth, y - FEET.height);
  const hotspots = new Map(scene.hotspots.map((hotspot) => [hotspot.symbol, hotspot]));
  const proximity = scene.hotspots
    .filter((hotspot) => hotspot.interactionRadius !== undefined)
    .map((hotspot) => ({
      hotspot,
      cells: rows.flatMap((row, z) =>
        [...row].flatMap((symbol, x) =>
          symbol === hotspot.symbol ? [{ x: left + x * cell, y: top + z * cell }] : [],
        ),
      ),
    }));

  k.loadSprite("room", scene.background);
  k.add([k.sprite("room"), k.pos(0, 0)]);
  for (const [index, animation] of (scene.animations ?? []).entries()) {
    const id = `room-animation-${index}`;
    k.loadSprite(id, animation.sprite, {
      sliceX: animation.columns,
      sliceY: animation.rows,
      anims: { loop: { from: 0, to: animation.frames - 1, loop: true, speed: animation.fps } },
    });
    k.add([
      k.sprite(id, { anim: "loop" }),
      k.pos(animation.x, animation.y),
      k.opacity(animation.opacity ?? 1),
      k.z(1),
    ]);
  }
  loadZeroSprite(k);
  const spawnRow = rows.findIndex((row) => row.includes("@"));
  const zero = k.add([
    k.sprite("zero", { anim: "idle-down" }),
    k.pos(left + (rows[spawnRow].indexOf("@") + 0.5) * cell, top + (spawnRow + 1) * cell - 1),
    k.anchor("bot"),
    k.z(10),
  ]);
  const foreground = (scene.foreground ?? []).map((layer, index) => {
    const id = `room-foreground-${index}`;
    k.loadSprite(id, layer.sprite);
    return { layer, object: k.add([k.sprite(id), k.pos(layer.x, layer.y), k.z(20)]) };
  });

  let heading: Facing = "down",
    walking = false,
    intent: readonly [number, number] = [0, 0],
    facing: Hotspot | undefined;
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
    dispose: () => k.quit(),
  };

  k.onUpdate(() => {
    const [mx, my] = room.frozen ? [0, 0] : intent;
    const length = Math.hypot(mx, my);
    if (length) {
      const step = (WALK_SPEED * Math.min(k.dt(), 0.05)) / length;
      // Axes move separately, so the player slides along furniture instead of sticking to it.
      if (mx && fits(zero.pos.x + mx * step, zero.pos.y)) zero.pos.x += mx * step;
      if (my && fits(zero.pos.x, zero.pos.y + my * step)) zero.pos.y += my * step;
      heading = facingOf(mx, my, heading);
    }
    const anim = `${length ? "walk" : "idle"}-${heading}`;
    if (zero.curAnim() !== anim || walking !== !!length) zero.play(anim);
    walking = !!length;
    for (const { layer, object } of foreground) object.hidden = zero.pos.y >= layer.feetY;

    const [hx, hz] = HEADING[heading];
    // Sideways the feet are wider than they are deep, so the reach starts from their edge.
    const reach = REACH + (hx ? FEET.halfWidth : 0);
    // What is in front wins over the clutter underfoot.
    const ahead =
      hotspots.get(
        symbolAt(zero.pos.x + hx * reach, zero.pos.y - FEET.height / 2 + hz * (reach + FEET.height / 2)),
      ) ?? hotspots.get(symbolAt(zero.pos.x, zero.pos.y - FEET.height / 2));
    // Large objects such as the dinner table work from any reachable edge, without pixel aiming.
    let nearest = Infinity;
    let nearby: Hotspot | undefined;
    for (const { hotspot, cells } of proximity) {
      for (const { x, y } of cells) {
        const dx = Math.max(x - zero.pos.x, 0, zero.pos.x - (x + cell));
        const dy = Math.max(y - zero.pos.y, 0, zero.pos.y - (y + cell));
        const distance = dx * dx + dy * dy;
        if (distance <= hotspot.interactionRadius! ** 2 && distance < nearest) {
          nearest = distance;
          nearby = hotspot;
        }
      }
    }
    const target = ahead ?? nearby;
    if (target !== facing) onFacing((facing = target));
  });
  return room;
}
