import { COMBAT } from "../combat";
import { combatMessage } from "../combat-message";
import { ITEMS, modifiedStat, RULES } from "../content";
import { blastCells, blastContact, linkedBombs, slideBlocked, SLIDE_STEP } from "../geometry";
import { canPlace } from "../placement";
import type { Blast, Bomb, Player, Vec2 } from "../types";
import { slidingZombieContact } from "../zombies";
import type { SimContext } from "./context";
import { emit } from "./events";
import { spreadFire } from "./fires";
import { destroyCover } from "./loot";

/** Half-extent within which a player still overlaps a bomb's cell. */
const FOOTPRINT = 0.5 + RULES.playerRadius;
/** Players this close to a new bomb may walk out of it once. Slightly wider than the footprint. */
const PLANT_OVERLAP = 0.75;

export function placeBomb(
  ctx: SimContext,
  p: Player,
  target: Vec2 = { x: Math.round(p.x), z: Math.round(p.z) },
) {
  const s = ctx.state,
    { x, z } = target;
  if (!canPlace(s, p, target)) return;
  s.bombs.push({
    id: ctx.nextId(),
    x,
    z,
    ownerId: p.id,
    power: Math.round(modifiedStat(p, "bombPower", p.attack, s.time)),
    range: modifiedStat(p, "bombRange", p.range, s.time),
    pierce: modifiedStat(p, "blastPierce", 0, s.time) || undefined,
    blastDuration: modifiedStat(p, "blastDuration", RULES.blastDuration, s.time),
    concealed: modifiedStat(p, "bombConcealed", 0, s.time) > 0 || undefined,
    detonateAt: s.time + modifiedStat(p, "bombFuse", RULES.fuse, s.time),
    passThrough: s.players
      .filter((a) => Math.abs(a.x - x) < PLANT_OVERLAP && Math.abs(a.z - z) < PLANT_OVERLAP)
      .map((a) => a.id),
  });
  emit(ctx, p, "放置炸药", { type: "bomb" });
}

/**
 * Hands `p` every other operator's live charge whose blast path joins up with the paths of `p`'s
 * own charges: credit, self-damage and blast-path visibility all follow the new owner. Returns
 * how many charges changed hands.
 */
export function seizeLinkedBombs(ctx: SimContext, p: Player) {
  const s = ctx.state;
  if (!p.alive || s.phase !== "playing") return 0;
  const linked = linkedBombs(s, p.id);
  for (const bomb of linked) {
    bomb.ownerId = p.id;
    bomb.seized = true;
    // A fresh id makes every client rebuild the charge in its new owner's colours.
    bomb.id = ctx.nextId();
  }
  return linked.length;
}

/** Moves a bomb one cell. A sliding bomb that is stopped, or that enters fire, goes off. */
export function slideBomb(ctx: SimContext, bomb: Bomb, dx: number, dz: number, kickerId?: string) {
  const s = ctx.state,
    x = bomb.x + dx,
    z = bomb.z + dz;
  if ((!dx && !dz) || !s.bombs.includes(bomb)) return;
  if (s.blasts.some((b) => b.x === bomb.x && b.z === bomb.z)) {
    explode(ctx, bomb);
    return;
  }
  if (slideBlocked(s, x, z, kickerId)) {
    if (bomb.slide) explode(ctx, bomb);
    return;
  }
  bomb.x = x;
  bomb.z = z;
  bomb.passThrough = [];
  bomb.slide = { x: dx, z: dz, arrivedAt: s.time + SLIDE_STEP, kickerId };
  if (s.blasts.some((b) => b.x === x && b.z === z)) explode(ctx, bomb);
}

/** Removes a live bomb and detonates it, optionally at the cell where it was caught mid-slide. */
export function explode(ctx: SimContext, bomb: Bomb, origin: Vec2 = bomb) {
  const s = ctx.state;
  if (!s.bombs.some((b) => b.id === bomb.id)) return;
  s.bombs = s.bombs.filter((b) => b.id !== bomb.id);
  detonate(ctx, origin === bomb ? bomb : { ...bomb, x: origin.x, z: origin.z });
}

/** Lays down blast cells, opens cover, then sets off every bomb the blast reaches. */
function detonate(ctx: SimContext, bomb: Bomb, source: NonNullable<Blast["source"]> = bomb.source ?? "bomb") {
  // Capture the original blockers before modifying crates for this explosion.
  ignite(ctx, bomb, blastCells(ctx.state, bomb), source, "blast", "炸药爆开");
}

/** One explosion over an arbitrary footprint: fire, opened cover, and the charges it sets off. */
export function ignite(
  ctx: SimContext,
  bomb: Pick<Bomb, "id" | "ownerId" | "x" | "z" | "range" | "power" | "blastDuration">,
  cells: readonly Vec2[],
  source: NonNullable<Blast["source"]>,
  announce: "blast" | "strike-impact",
  text: string,
) {
  const s = ctx.state;
  const owner = s.players.find((p) => p.id === bomb.ownerId)!;
  const duration = bomb.blastDuration ?? RULES.blastDuration;
  let destroyed = 0,
    coverScore = 0;
  for (const cell of cells) {
    s.blasts.push({
      ...cell,
      explosionId: bomb.id,
      source,
      id: ctx.nextId(),
      ownerId: bomb.ownerId,
      originX: bomb.x,
      originZ: bomb.z,
      power: bomb.power ?? COMBAT.attack,
      range: bomb.range,
      duration,
      expiresAt: s.time + duration,
    });
    s.items = s.items.filter((i) => i.x !== cell.x || i.z !== cell.z);
    if (s.tiles[cell.z][cell.x] === 2) {
      coverScore += destroyCover(ctx, owner, cell.x, cell.z);
      if (owner.alive) destroyed++;
    }
  }
  if (destroyed)
    emit(
      ctx,
      owner,
      combatMessage("摧毁掩体 ×{0} · +{1} 积分", destroyed, coverScore),
      { type: "cover" },
      bomb,
    );
  emit(ctx, owner, text, { type: announce }, bomb);
  const reached = (x: number, z: number) => cells.some((c) => c.x === x && c.z === z);
  for (const other of s.bombs) {
    const contact = blastContact(other, s.time, reached);
    if (contact) explode(ctx, other, contact);
  }
}

/** Resolves thrown items whose flight has ended, through their module's onLand hook. */
export function landThrown(ctx: SimContext) {
  const s = ctx.state;
  for (const t of s.thrown) {
    if (t.landsAt > s.time) continue;
    ITEMS[t.kind]?.onLand?.({
      projectile: t,
      burn: (fire) => spreadFire(ctx, t, fire),
      explode: (range, { fuse = 0, powerScale = 1 } = {}) => {
        const charge: Bomb = {
          id: t.id,
          ownerId: t.ownerId,
          x: t.x,
          z: t.z,
          range,
          power: Math.round(t.power * powerScale),
          source: "throwable",
          kind: t.kind,
          passThrough: s.players
            .filter((a) => Math.abs(a.x - t.x) < PLANT_OVERLAP && Math.abs(a.z - t.z) < PLANT_OVERLAP)
            .map((a) => a.id),
          detonateAt: s.time + fuse,
        };
        // With a fuse it lies there as a live charge that can be dodged, kicked or chained.
        if (fuse > 0 && !s.bombs.some((b) => b.x === t.x && b.z === t.z)) s.bombs.push(charge);
        else detonate(ctx, charge);
      },
    });
  }
  s.thrown = s.thrown.filter((t) => t.landsAt > s.time);
}

/**
 * Per-tick bomb update, in this order: fuses and fire contact, then slides, then pass-through
 * bookkeeping. The loops walk the list as it was when each began; explode() replaces the array
 * and ignores bombs that are already gone.
 */
export function updateBombs(ctx: SimContext) {
  const s = ctx.state;
  const onFire = (x: number, z: number) => s.blasts.some((b) => b.x === x && b.z === z);
  for (const bomb of s.bombs) {
    const contact = blastContact(bomb, s.time, onFire);
    if (contact || (!bomb.slide && bomb.detonateAt <= s.time)) explode(ctx, bomb, contact);
  }
  for (const bomb of s.bombs) {
    const slide = bomb.slide;
    if (!slide) continue;
    const victim = slidingZombieContact(s.zombies, bomb, s.time);
    if (victim) explode(ctx, bomb, victim);
    else if (s.time >= slide.arrivedAt) slideBomb(ctx, bomb, slide.x, slide.z);
  }
  // Players overlapping a fresh bomb may leave its footprint once.
  for (const b of s.bombs)
    b.passThrough = b.passThrough.filter((id) => {
      const p = s.players.find((p) => p.id === id)!;
      return Math.abs(p.x - b.x) < FOOTPRINT && Math.abs(p.z - b.z) < FOOTPRINT;
    });
}
