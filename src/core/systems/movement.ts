import { eachOwned, modifiedStat, RULES } from "../content";
import { clearSight, KICK } from "../geometry";
import { recoverOrSpend, sprintSeconds, STAMINA } from "../stamina";
import { zoneWallInset } from "../zone";
import type { Bomb, Player, PlayerInput } from "../types";
import { explode, slideBomb } from "./bombs";
import type { SimContext } from "./context";

/** Walk, sprint, jump and kick for one tick. In the overhead view movement snaps to one axis. */
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
  const length = Math.max(1, Math.hypot(mx, mz));
  const speed = modifiedStat(p, "moveSpeed", p.speed, s.time);
  const sprint = sprintSeconds(p, Boolean(input.sprint && (mx || mz)), dt);
  const distance = speed * (dt + sprint * (STAMINA.speedFactor - 1));
  const x = (mx / length) * distance,
    z = (mz / length) * distance;
  const startX = p.x,
    startZ = p.z;
  if (p.elevation === 0 && (x || z) && s.bombs.length && canKick(p)) tryKick(ctx, p, x, z);
  else delete p.kickPush;
  // Axes resolve separately so the player slides along walls.
  const blockedX = !!x && !tryOccupy(ctx, p, p.x + x, p.z);
  if (x && !blockedX) p.x += x;
  const blockedZ = !!z && !tryOccupy(ctx, p, p.x, p.z + z);
  if (z && !blockedZ) p.z += z;
  // Overhead the player runs down the middle of the lanes, as in classic arena bombers: moving on
  // one axis eases the other back to the lane centre, so turns into side corridors always line up.
  if (overhead) {
    if (x && !blockedX) alignToLane(ctx, p, "z", Math.abs(x));
    if (z && !blockedZ) alignToLane(ctx, p, "x", Math.abs(z));
  }
  // A windup in progress means the player is deliberately pushing a bomb, not rounding a corner.
  if (!p.kickPush) {
    if (blockedX) assistCorner(ctx, p, "x", x, z);
    if (blockedZ) assistCorner(ctx, p, "z", z, x);
  }
  recoverOrSpend(p, p.x !== startX || p.z !== startZ ? sprint : 0, dt, s.time);
}

/** Moves the player up to `step` toward the centre of the current lane on `axis`, if the way is open. */
function alignToLane(ctx: SimContext, p: Player, axis: "x" | "z", step: number) {
  const offset = Math.round(p[axis]) - p[axis];
  if (!offset) return;
  const nudge = Math.sign(offset) * Math.min(Math.abs(offset), step);
  const [nx, nz] = axis === "x" ? [p.x + nudge, p.z] : [p.x, p.z + nudge];
  if (!blockerAt(ctx, p, nx, nz)) p[axis] += nudge;
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
function tryKick(ctx: SimContext, p: Player, moveX: number, moveZ: number) {
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
    if (ahead <= 0 || ahead > KICK.reach + KICK.approach || across > KICK.alignment) continue;
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
  if (s.time - push.since < KICK.windup || best > KICK.reach) return;
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
