import kaplay from "kaplay";
import { STORY_ART } from "./assets";
import { VIEW, type Hotspot, type RoomScene } from "./script";

/** Pixels per second. */
const WALK_SPEED = 58;
/** The feet: what collides with furniture. Positions are the bottom centre of the sprite. */
const FEET = { halfWidth: 4, height: 4 };
/** How far in front of the feet the player can examine. */
const REACH = 7;
/** Rows of the walk sheet, top to bottom; each holds four 16 x 32 frames. */
const FACINGS = ["down", "up", "left", "right"] as const;
type Facing = (typeof FACINGS)[number];
const FRAMES = 4;
const HEADING: Record<Facing, readonly [number, number]> = {
  down: [0, 1],
  up: [0, -1],
  left: [-1, 0],
  right: [1, 0],
};

export interface Room {
  /** Walking direction; (0, 0) stands still. Ignored while `frozen`. */
  move(x: number, y: number): void;
  frozen: boolean;
  /** The hotspot in front of the player, if any. */
  readonly facing: Hotspot | undefined;
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
  const walkable = (x: number, y: number) => ".@".includes(symbolAt(x, y));
  const fits = (x: number, y: number) =>
    walkable(x - FEET.halfWidth, y) &&
    walkable(x + FEET.halfWidth, y) &&
    walkable(x - FEET.halfWidth, y - FEET.height) &&
    walkable(x + FEET.halfWidth, y - FEET.height);
  const hotspots = new Map(scene.hotspots.map((hotspot) => [hotspot.symbol, hotspot]));

  k.loadSprite("room", scene.background);
  k.add([k.sprite("room"), k.pos(0, 0)]);
  k.loadSprite("zero", STORY_ART.zeroWalk, {
    sliceX: FRAMES,
    sliceY: FACINGS.length,
    anims: Object.fromEntries(
      FACINGS.flatMap((facing, row) => [
        [`idle-${facing}`, row * FRAMES],
        [`walk-${facing}`, { from: row * FRAMES, to: row * FRAMES + FRAMES - 1, loop: true, speed: 8 }],
      ]),
    ),
  });
  const spawnRow = rows.findIndex((row) => row.includes("@"));
  const zero = k.add([
    k.sprite("zero", { anim: "idle-down" }),
    k.pos(left + (rows[spawnRow].indexOf("@") + 0.5) * cell, top + (spawnRow + 1) * cell - 1),
    k.anchor("bot"),
    k.z(10),
  ]);

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
      heading = Math.abs(mx) > Math.abs(my) ? (mx < 0 ? "left" : "right") : my < 0 ? "up" : "down";
    }
    const anim = `${length ? "walk" : "idle"}-${heading}`;
    if (zero.curAnim() !== anim || walking !== !!length) zero.play(anim);
    walking = !!length;

    const [hx, hz] = HEADING[heading];
    // Sideways the feet are wider than they are deep, so the reach starts from their edge.
    const reach = REACH + (hx ? FEET.halfWidth : 0);
    const ahead = hotspots.get(
      symbolAt(zero.pos.x + hx * reach, zero.pos.y - FEET.height / 2 + hz * (reach + FEET.height / 2)),
    );
    if (ahead !== facing) onFacing((facing = ahead));
  });
  return room;
}
