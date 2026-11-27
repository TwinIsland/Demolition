import kaplay from "kaplay";
import { FACINGS, tileArt, zeroSheet, type Facing } from "./placeholder-art";
import { CELL, VIEW, type Hotspot, type RoomScene } from "./script";

/** Pixels per second. */
const WALK_SPEED = 62;
/** The feet: what collides with furniture. Positions are the bottom centre of the sprite. */
const FEET = { halfWidth: 4, height: 6 };
/** How far in front of the feet the player can examine. */
const REACH = 9;
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
 * Runs a walkable 8-bit room on `canvas` with Kaplay. Kaplay draws and animates; the room is a
 * grid, so collision is a lookup in the scene's layout. `onFacing` reports the hotspot in reach
 * whenever it changes.
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
    top = Math.floor((VIEW.height - rows.length * CELL) / 2),
    left = Math.floor((VIEW.width - rows[0].length * CELL) / 2);
  const symbolAt = (x: number, y: number) =>
    rows[Math.floor((y - top) / CELL)]?.[Math.floor((x - left) / CELL)] ?? "#";
  const walkable = (x: number, y: number) => ".@".includes(symbolAt(x, y));
  const fits = (x: number, y: number) =>
    walkable(x - FEET.halfWidth, y) &&
    walkable(x + FEET.halfWidth, y) &&
    walkable(x - FEET.halfWidth, y - FEET.height) &&
    walkable(x + FEET.halfWidth, y - FEET.height);
  const hotspots = new Map(scene.hotspots.map((hotspot) => [hotspot.symbol, hotspot]));

  // Scenery: one painting, or a tile per cell with the floor under the furniture.
  if (scene.background) {
    k.loadSprite("room", scene.background);
    k.add([k.sprite("room"), k.pos(0, 0)]);
  } else {
    for (const symbol of new Set(rows.join("").replace("@", ".")))
      k.loadSprite(`tile-${symbol}`, tileArt(symbol));
    rows.forEach((row, cz) =>
      [...row].forEach((symbol, cx) => {
        const at = k.pos(left + cx * CELL, top + cz * CELL);
        k.add([k.sprite("tile-."), at]);
        if (!".@".includes(symbol)) k.add([k.sprite(`tile-${symbol}`), at]);
      }),
    );
  }

  k.loadSprite("zero", zeroSheet(), {
    sliceX: 2,
    sliceY: FACINGS.length,
    anims: Object.fromEntries(
      FACINGS.flatMap((facing, row) => [
        [`idle-${facing}`, row * 2],
        [`walk-${facing}`, { from: row * 2, to: row * 2 + 1, loop: true, speed: 6 }],
      ]),
    ),
  });
  const spawnRow = rows.findIndex((row) => row.includes("@"));
  const zero = k.add([
    k.sprite("zero", { anim: "idle-down" }),
    k.pos(left + (rows[spawnRow].indexOf("@") + 0.5) * CELL, top + (spawnRow + 1) * CELL - 2),
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
    const ahead = hotspots.get(symbolAt(zero.pos.x + hx * REACH, zero.pos.y - FEET.height / 2 + hz * REACH));
    if (ahead !== facing) onFacing((facing = ahead));
  });
  return room;
}
