import { eachOwned, modifiedStat, RULES } from "../content";
import { clearSight, KICK } from "../geometry";
import { recoverOrSpend, sprintSeconds, STAMINA } from "../stamina";
import { zoneWallInset } from "../zone";
import type { Bomb, Player, PlayerInput } from "../types";
import { explode, slideBomb } from "./bombs";
import type { SimContext } from "./context";

/** Overhead view: how far off a lane centre the corner assist still reaches. Half a tile is all of it. */
const OVERHEAD_ASSIST = 0.5;

type Axis = "x" | "z";

/**
 * Walk, sprint, jump and kick for one tick. Both views run the same continuous walk with the same
 * speed, collision and kick rules; the overhead view only narrows it to one axis at a time and
 * steers the player along the lanes (see `moveOverhead`).
 */
export function move(ctx: SimContext, p: Player, input: PlayerInput, dt: number, overhead: boolean) {
  const s = ctx.state;
  const jump = !!input.jump && !overhead;
  if (jump || p.elevation > 0 || p.verticalSpeed !== 0) moveVertically(p, jump, dt);
  const mx = Number.isFinite(input.moveX) ? input.moveX : 0;
  const mz = Number.isFinite(input.moveZ) ? input.moveZ : 0;
  const speed = modifiedStat(p, "moveSpeed", p.speed, s.time);
  const startX = p.x,
    startZ = p.z;
  const sprint = sprintSeconds(p, Boolean(input.sprint && (mx || mz)), dt);
  const distance = speed * (dt + sprint * (STAMINA.speedFactor - 1));
  if (overhead) {
    moveOverhead(ctx, p, mx, mz, input.preferAxis, distance);
    recoverOrSpend(p, p.x !== startX || p.z !== startZ ? sprint : 0, dt, s.time);
    return;
  }
  const length = Math.max(1, Math.hypot(mx, mz));
  const x = (mx / length) * distance,
    z = (mz / length) * distance;
  if (p.elevation === 0 && (x || z) && s.bombs.length && canKick(p)) tryKick(ctx, p, x, z);
  else delete p.kickPush;
  // Axes resolve separately so the player slides along walls.
  const blockedX = !!x && !tryOccupy(ctx, p, p.x + x, p.z);
  if (x && !blockedX) p.x += x;
  const blockedZ = !!z && !tryOccupy(ctx, p, p.x, p.z + z);
  if (z && !blockedZ) p.z += z;
  // A windup in progress means the player is deliberately pushing a bomb, not rounding a corner.
  if (!p.kickPush) {
    if (blockedX) assistCorner(ctx, p, "x", x, z);
    if (blockedZ) assistCorner(ctx, p, "z", z, x);
  }
  recoverOrSpend(p, p.x !== startX || p.z !== startZ ? sprint : 0, dt, s.time);
}

/**
 * Overhead movement, with the feel of a classic arena bomber on top of the first-person walk. The
 * player moves continuously and stops the tick the keys are released; nothing commits to a whole
 * tile. Three aids stand in for the grid:
 *  - one axis per tick, so the path is always four-way;
 *  - while walking, the player is drawn sideways onto the centre of the lane, so turns line up;
 *  - walking into a corner beside an opening slides around it, from anywhere on the tile.
 * With both axes pressed the preferred one (the latest key; for analog input the larger) is tried
 * first and the other is the fallback. Holding a turn before the opening therefore keeps the
 * player walking and takes the turn the moment it opens.
 */
function moveOverhead(
  ctx: SimContext,
  p: Player,
  mx: number,
  mz: number,
  prefer: Axis | undefined,
  distance: number,
) {
  const want = { x: Math.max(-1, Math.min(1, mx)), z: Math.max(-1, Math.min(1, mz)) };
  const first: Axis =
    prefer && want[prefer] ? prefer : Math.abs(want.x) >= Math.abs(want.z) && want.x ? "x" : "z";
  if (!want[first]) {
    delete p.kickPush;
    return;
  }
  const kicking = p.elevation === 0 && ctx.state.bombs.length > 0 && canKick(p);
  if (kicking) tryKick(ctx, p, first === "x" ? want.x : 0, first === "z" ? want.z : 0);
  else delete p.kickPush;
  // A windup in progress means the player is deliberately pushing a bomb: no assist, no detour.
  const second: Axis = first === "x" ? "z" : "x";
  if (walkAxis(ctx, p, first, want[first] * distance, want[second], !p.kickPush) || p.kickPush) return;
  if (want[second]) walkAxis(ctx, p, second, want[second] * distance, 0, true);
}

/**
 * One overhead step along `axis`. True when the player moved, either ahead or around a corner.
 * `across` is what the player wants on the other axis; the lane never pulls against it.
 */
function walkAxis(ctx: SimContext, p: Player, axis: Axis, step: number, across: number, assist: boolean) {
  const open = axis === "x" ? tryOccupy(ctx, p, p.x + step, p.z) : tryOccupy(ctx, p, p.x, p.z + step);
  if (!open) return assist && assistCorner(ctx, p, axis, step, 0, OVERHEAD_ASSIST);
  p[axis] += step;
  // Lane magnet: drift onto the centre line at walking pace.
  const side = axis === "x" ? "z" : "x";
  const offset = Math.round(p[side]) - p[side];
  if (offset && (!across || Math.sign(across) === Math.sign(offset))) {
    const nudge = Math.sign(offset) * Math.min(Math.abs(offset), Math.abs(step));
    const [nx, nz] = axis === "x" ? [p.x, p.z + nudge] : [p.x + nudge, p.z];
    if (!blockerAt(ctx, p, nx, nz)) p[side] += nudge;
  }
  return true;
}

/**
 * Corner assist. A player walking into the edge of an opening is only a little off the lane
 * centre; instead of sticking on the corner, slip sideways toward the centre at walking pace.
 * `along` is the blocked step on `axis`; `across` is the player's own step on the other axis.
 * True when the player was moved.
 */
function assistCorner(
  ctx: SimContext,
  p: Player,
  axis: Axis,
  along: number,
  across: number,
  range: number = RULES.cornerAssist,
) {
  const side = axis === "x" ? "z" : "x";
  const lane = Math.round(p[side]);
  const offset = lane - p[side];
  if (!offset || Math.abs(offset) > range) return false;
  // Steering away from the lane overrides the assist.
  if (across && Math.sign(across) !== Math.sign(offset)) return false;
  const ahead = p[axis] + along;
  const open = axis === "x" ? !blockerAt(ctx, p, ahead, lane) : !blockerAt(ctx, p, lane, ahead);
  if (!open) return false;
  const nudge = Math.sign(offset) * Math.min(Math.abs(offset), Math.abs(along));
  const [nx, nz] = axis === "x" ? [p.x, p.z + nudge] : [p.x + nudge, p.z];
  if (blockerAt(ctx, p, nx, nz)) return false;
  p[side] += nudge;
  return true;
}

/** Only players who own a kick hook track a push, so the HUD never shows a windup they lack. */
function canKick(p: Player) {
  let owned = false;
  eachOwned(p, (mod) => {
    if (mod.onBombContact) owned = true;
  });
  return owned;
}

function moveVertically(p: Player, jump: boolean, dt: number) {
  if (jump && p.elevation === 0 && p.verticalSpeed === 0) p.verticalSpeed = RULES.jumpSpeed;
  const gravity = p.verticalSpeed > 0 ? RULES.jumpGravity : RULES.fallGravity;
  p.elevation += p.verticalSpeed * dt - 0.5 * gravity * dt * dt;
  p.verticalSpeed -= gravity * dt;
  if (p.elevation <= 0) {
    p.elevation = 0;
    p.verticalSpeed = 0;
  }
}

/**
 * A kick is a deliberate push: the player stands outside the bomb, is lined up with it,
 * touches it, and keeps moving into it for KICK.windup seconds. A bomb the player is still
 * standing on (its passThrough list) is never kicked, so stepping off a fresh bomb is safe.
 */
function tryKick(ctx: SimContext, p: Player, moveX: number, moveZ: number, reach: number = KICK.reach) {
  const dx = Math.abs(moveX) >= Math.abs(moveZ) ? Math.sign(moveX) : 0;
  const dz = dx ? 0 : Math.sign(moveZ);
  const s = ctx.state;
  let nearest: Bomb | undefined;
  let best = Infinity;
  for (const bomb of s.bombs) {
    if (bomb.slide || bomb.passThrough.includes(p.id)) continue;
    const x = bomb.x - p.x,
      z = bomb.z - p.z;
    const ahead = x * dx + z * dz,
      across = Math.abs(x * dz - z * dx);
    if (ahead <= 0 || ahead > reach + KICK.approach || across > KICK.alignment) continue;
    if (ahead < best && clearSight(s, p, bomb)) {
      best = ahead;
      nearest = bomb;
    }
  }
  if (!nearest) {
    delete p.kickPush;
    return;
  }
  const bomb = nearest,
    push = p.kickPush;
  if (push?.bombId !== bomb.id || push.x !== dx || push.z !== dz) {
    p.kickPush = { bombId: bomb.id, x: dx, z: dz, since: s.time };
    return;
  }
  // The windup may complete during the approach; the kick itself needs contact.
  if (s.time - push.since < KICK.windup || best > reach) return;
  delete p.kickPush;
  eachOwned(p, (mod) =>
    mod.onBombContact?.(() => {
      if (!bomb.slide) slideBomb(ctx, bomb, dx, dz, p.id);
    }),
  );
}

/** Pure collision query: the wall or bomb that keeps the player out of this position. */
function blockerAt(ctx: SimContext, p: Player, x: number, z: number): "tile" | Bomb | undefined {
  const s = ctx.state,
    r = RULES.playerRadius;
  if (s.zone) {
    const edge = zoneWallInset(s.time, s.zone) + r;
    if (x < edge || z < edge || x > s.size - 1 - edge || z > s.size - 1 - edge) return "tile";
  }
  for (const px of [x - r, x + r])
    for (const pz of [z - r, z + r]) {
      const cx = Math.round(px),
        cz = Math.round(pz);
      if (s.tiles[cz]?.[cx] !== 0) return "tile";
      const bomb = s.bombs.find(
        (b) => b.x === cx && b.z === cz && b.slide?.kickerId !== p.id && !b.passThrough.includes(p.id),
      );
      if (bomb) return bomb;
    }
}

/** Movement attempt. Walking into a sliding bomb sets it off, which is a rule, not a query. */
function tryOccupy(ctx: SimContext, p: Player, x: number, z: number) {
  const blocker = blockerAt(ctx, p, x, z);
  if (blocker && blocker !== "tile" && blocker.slide) explode(ctx, blocker);
  return !blocker;
}
