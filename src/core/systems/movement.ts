import { eachOwned, modifiedStat, RULES } from "../content";
import { clearSight, KICK } from "../geometry";
import { recoverOrSpend, sprintSeconds, STAMINA } from "../stamina";
import { zoneWallInset } from "../zone";
import type { Bomb, Player, PlayerInput } from "../types";
import { explode, slideBomb } from "./bombs";
import type { SimContext } from "./context";

/** Seconds a direction pressed during a grid step still counts when the step ends. */
const STEP_BUFFER = 0.22;
/** Centre distance at which a grid walker, who cannot lean into a bomb, already pushes it. */
const GRID_KICK_REACH = 1.05;

/** Walk, sprint, jump and kick for one tick. In the overhead view movement goes tile by tile. */
export function move(ctx: SimContext, p: Player, input: PlayerInput, dt: number, overhead: boolean) {
  const s = ctx.state;
  const jump = !!input.jump && !overhead;
  if (jump || p.elevation > 0 || p.verticalSpeed !== 0) moveVertically(p, jump, dt);
  let mx = Number.isFinite(input.moveX) ? input.moveX : 0;
  let mz = Number.isFinite(input.moveZ) ? input.moveZ : 0;
  if (overhead && mx && mz) {
    if (Math.abs(mx) >= Math.abs(mz)) mz = 0;
    else mx = 0;
  }
  const speed = modifiedStat(p, "moveSpeed", p.speed, s.time);
  const startX = p.x,
    startZ = p.z;
  if (overhead) {
    const sprint = sprintSeconds(p, Boolean(input.sprint && (mx || mz || p.gridStep)), dt);
    moveOnGrid(ctx, p, Math.sign(mx), Math.sign(mz), speed * (dt + sprint * (STAMINA.speedFactor - 1)));
    recoverOrSpend(p, p.x !== startX || p.z !== startZ ? sprint : 0, dt, s.time);
    return;
  }
  delete p.gridStep;
  const length = Math.max(1, Math.hypot(mx, mz));
  const sprint = sprintSeconds(p, Boolean(input.sprint && (mx || mz)), dt);
  const distance = speed * (dt + sprint * (STAMINA.speedFactor - 1));
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
 * Overhead movement, as in classic arena bombers: the player stands on tile centres and walks one
 * whole tile at a time. A step, once begun, is finished; a tap is exactly one tile, a held key
 * keeps walking without a pause between tiles, and a turn pressed during a step is taken when
 * the step ends. `dx`/`dz` is the wanted direction, on one axis.
 */
function moveOnGrid(ctx: SimContext, p: Player, dx: number, dz: number, distance: number) {
  const s = ctx.state;
  const wants = dx !== 0 || dz !== 0;
  if (wants && s.bombs.length && canKick(p)) tryKick(ctx, p, dx, dz, GRID_KICK_REACH);
  else delete p.kickPush;
  let step = p.gridStep;
  if (step && wants && (dx !== step.dx || dz !== step.dz)) step.queued = { dx, dz, at: s.time };
  // At most two tiles a tick; only a huge speed bonus could ever need the second.
  for (let i = 0; i < 2 && distance > 1e-9; i++) {
    if (!step) {
      const here = { x: Math.round(p.x), z: Math.round(p.z) };
      if (p.x !== here.x || p.z !== here.z) {
        // Off the grid (just switched views, or shoved): walk to the nearest tile centre first.
        step = p.gridStep = { ...here, dx: 0, dz: 0 };
      } else {
        const queued = p.gridQueued && s.time - p.gridQueued.at <= STEP_BUFFER ? p.gridQueued : undefined;
        delete p.gridQueued;
        // A buffered turn wins over the key still held, if that way is open.
        const choice = [queued, wants ? { dx, dz } : undefined].find(
          (d) => d && !blockerAt(ctx, p, here.x + d.dx, here.z + d.dz),
        );
        if (!choice) {
          const bump = queued ?? (wants ? { dx, dz } : undefined);
          // Walking into a sliding bomb still sets it off.
          if (bump) tryOccupy(ctx, p, here.x + bump.dx, here.z + bump.dz);
          return;
        }
        step = p.gridStep = { x: here.x + choice.dx, z: here.z + choice.dz, dx: choice.dx, dz: choice.dz };
      }
    }
    const tx = step.x - p.x,
      tz = step.z - p.z;
    const remaining = Math.abs(tx) + Math.abs(tz);
    const travel = Math.min(distance, remaining);
    // One axis at a time; only a walk back onto the grid ever has both.
    const nx = p.x + Math.sign(tx) * Math.min(Math.abs(tx), travel),
      nz = p.z + Math.sign(tz) * Math.min(Math.abs(tz), Math.max(0, travel - Math.abs(tx)));
    if (!tryOccupy(ctx, p, nx, nz)) {
      // The way closed mid-step (a wall rose, a bomb slid in): go back to the tile just left.
      const back = { x: step.x - step.dx, z: step.z - step.dz };
      const retreat = step.dx !== 0 || step.dz !== 0;
      if (retreat && !blockerAt(ctx, p, back.x, back.z)) p.gridStep = { ...back, dx: -step.dx, dz: -step.dz };
      else delete p.gridStep;
      return;
    }
    p.x = nx;
    p.z = nz;
    distance -= travel;
    if (travel < remaining) return;
    p.x = step.x;
    p.z = step.z;
    if (step.queued) p.gridQueued = step.queued;
    step = undefined;
    delete p.gridStep;
  }
}

/**
 * Corner assist. A player walking into the edge of an opening is only a little off the lane
 * centre; instead of sticking on the corner, slip sideways toward the centre at walking pace.
 * `along` is the blocked step on `axis`; `across` is the player's own step on the other axis.
 */
function assistCorner(ctx: SimContext, p: Player, axis: "x" | "z", along: number, across: number) {
  const side = axis === "x" ? "z" : "x";
  const lane = Math.round(p[side]);
  const offset = lane - p[side];
  if (!offset || Math.abs(offset) > RULES.cornerAssist) return;
  // Steering away from the lane overrides the assist.
  if (across && Math.sign(across) !== Math.sign(offset)) return;
  const ahead = p[axis] + along;
  const open = axis === "x" ? !blockerAt(ctx, p, ahead, lane) : !blockerAt(ctx, p, lane, ahead);
  if (!open) return;
  const nudge = Math.sign(offset) * Math.min(Math.abs(offset), Math.abs(along));
  const [nx, nz] = axis === "x" ? [p.x, p.z + nudge] : [p.x + nudge, p.z];
  if (!blockerAt(ctx, p, nx, nz)) p[side] += nudge;
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
