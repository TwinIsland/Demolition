import { combatMessage } from "../combat-message";
import { RULES } from "../content";
import { DIRECTIONS } from "../maps";
import { ringOf, zoneAt } from "../zone";
import type { GameSnapshot, Player, Vec2 } from "../types";
import { cancelBuild, removeBuiltCrate } from "./building";
import { explode } from "./bombs";
import type { SimContext } from "./context";
import { emit } from "./events";

/** Seconds between "hurt" events for a player standing in zone fire. */
const BURN_EVENT_INTERVAL = 0.6;

/** Health lost by an operator caught in a ring as its wall comes up. Shields do not absorb it. */
const CRUSH_DAMAGE = 35;

/**
 * Advances the closing safe zone. The boundary wall moves inward one ring at a time: a ring that
 * closes becomes solid wall, taking the cover, items, bombs and zombies in it, and shoving any
 * operator still there into the nearest open cell with a crushing hit. Once the zone is at its
 * smallest and the hold has passed, the remaining square burns and nobody can gain health back.
 */
export function stepZone(ctx: SimContext, dt: number) {
  const s = ctx.state;
  if (s.mode === "practice") return;
  const before = s.zone?.closed ?? 0;
  const zone = (s.zone = zoneAt(s.size, s.time, s.duration));
  for (let ring = before + 1; ring <= zone.closed; ring++) closeRing(ctx, ring);

  if (zone.final) {
    for (const bomb of s.bombs) explode(ctx, bomb);
    s.items = [];
    s.zombies = [];
  }
  for (const p of s.players) {
    if (!p.alive || !zone.final) continue;
    // No recovery in the firestorm: health can only go down from here.
    const cap = Math.min(ctx.healthCaps.get(p.id) ?? p.hp, p.hp);
    ctx.healthCaps.set(p.id, cap);
    p.hp = cap;
    burn(ctx, p, zone.damage * dt);
  }
}

/** Turns one ring into wall and clears everything that stood in it. */
function closeRing(ctx: SimContext, ring: number) {
  const s = ctx.state,
    size = s.size,
    inRing = (p: Vec2) => ringOf(size, p) <= ring;
  for (let z = 0; z < size; z++)
    for (let x = 0; x < size; x++) {
      if (ringOf(size, { x, z }) !== ring) continue;
      const cell = z * size + x;
      if (s.tiles[z][x] === 2) {
        delete s.coverDamage?.[s.coverOrigins?.[cell] ?? cell];
        delete s.coverOrigins?.[cell];
        removeBuiltCrate(s, x, z);
      }
      s.tiles[z][x] = 1;
      // A wall swallowed by the boundary is no longer one a terrain reset may move.
      delete s.wallOrigins?.[cell];
    }
  // The cells just inside the new boundary become a clear lap of the arena: permanent walls there
  // come down, so nobody is left boxed in between the boundary and interior walls.
  for (let z = 0; z < size; z++)
    for (let x = 0; x < size; x++) {
      if (s.tiles[z][x] !== 1 || ringOf(size, { x, z }) !== ring + 1) continue;
      s.tiles[z][x] = 0;
      delete s.wallOrigins?.[z * size + x];
    }
  s.bombs = s.bombs.filter((bomb) => !inRing(bomb));
  s.items = s.items.filter((item) => !inRing(item));
  s.zombies = s.zombies.filter((zombie) => !inRing(zombie));
  reconnect(s, ring);
  for (const p of s.players) if (p.alive) clearOfWalls(ctx, p, ring, inRing(p));
  s.coverRevision = (s.coverRevision ?? 0) + 1;
  ctx.undead.terrainChanged(s.time);
}

/**
 * The ring that closed may have been the only link between two parts of the arena. Opens movable
 * interior walls, in cell order, until the walkable area inside is one piece again.
 */
function reconnect(s: GameSnapshot, ring: number) {
  const size = s.size,
    walls = s.wallOrigins;
  if (!walls) return;
  for (;;) {
    const label = new Int32Array(size * size);
    let regions = 0;
    for (let start = 0; start < size * size; start++) {
      if (label[start] || s.tiles[Math.floor(start / size)][start % size] === 1) continue;
      label[start] = ++regions;
      const queue = [start];
      for (let i = 0; i < queue.length; i++)
        for (const d of DIRECTIONS) {
          const next = queue[i] + d.z * size + d.x;
          if (label[next] || s.tiles[Math.floor(next / size)][next % size] === 1) continue;
          label[next] = regions;
          queue.push(next);
        }
    }
    if (regions <= 1) return;
    const bridge = Object.keys(walls)
      .map(Number)
      .sort((a, b) => a - b)
      .find((cell) => {
        if (ringOf(size, { x: cell % size, z: Math.floor(cell / size) }) <= ring) return false;
        const seen = new Set(DIRECTIONS.map((d) => label[cell + d.z * size + d.x]).filter(Boolean));
        return seen.size > 1;
      });
    if (bridge === undefined) return;
    s.tiles[Math.floor(bridge / size)][bridge % size] = 0;
    delete walls[bridge];
  }
}

/** True when any corner of the player's footprint at (x, z) lies in a solid cell; matches movement. */
function overlapsWall(s: GameSnapshot, x: number, z: number) {
  const r = RULES.playerRadius;
  for (const px of [x - r, x + r])
    for (const pz of [z - r, z + r]) if (s.tiles[Math.round(pz)]?.[Math.round(px)] !== 0) return true;
  return false;
}

/**
 * Makes sure no operator is left inside the new wall. One whose centre was still on an open cell
 * but whose body reached into the ring is eased back to that cell's centre, unharmed. One standing
 * in the ring itself is shoved into the nearest open cell further in and crushed.
 */
function clearOfWalls(ctx: SimContext, p: Player, ring: number, caught: boolean) {
  const s = ctx.state;
  if (!caught) {
    if (!overlapsWall(s, p.x, p.z)) return;
    const own = { x: Math.round(p.x), z: Math.round(p.z) };
    if (s.tiles[own.z]?.[own.x] === 0) {
      startShove(s, p, own);
      return;
    }
  }
  crush(ctx, p, ring);
}

/** Seconds a shove out of a closing ring takes. */
const SHOVE_TIME = 0.15;

function startShove(s: GameSnapshot, p: Player, target: Vec2) {
  p.shove = {
    x: target.x,
    z: target.z,
    from: { x: p.x, z: p.z },
    startAt: s.time,
    endAt: s.time + SHOVE_TIME,
  };
  delete p.kickPush;
}

/** Shoves an operator out of a closing ring into the nearest open cell further in. */
function crush(ctx: SimContext, p: Player, ring: number) {
  const s = ctx.state,
    size = s.size,
    middle = (size - 1) / 2;
  let best: Vec2 | undefined,
    bestDistance = Infinity;
  for (let z = ring + 1; z < size - 1 - ring; z++)
    for (let x = ring + 1; x < size - 1 - ring; x++) {
      if (s.tiles[z][x] !== 0 || s.bombs.some((bomb) => bomb.x === x && bomb.z === z)) continue;
      // Ties go to the cell nearer the centre, then to scan order, so the result is deterministic.
      const distance = Math.hypot(x - p.x, z - p.z) + Math.hypot(x - middle, z - middle) * 1e-3;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { x, z };
      }
    }
  if (best) startShove(s, p, best);
  cancelBuild(p);
  p.hp = best ? Math.max(0, p.hp - CRUSH_DAMAGE) : 0;
  if (ctx.healthCaps.has(p.id)) ctx.healthCaps.set(p.id, p.hp);
  if (p.hp > 0) {
    emit(ctx, p, "被合拢的围墙挤压", { type: "hurt", blocked: false });
    return;
  }
  p.alive = false;
  p.offers = [];
  emit(ctx, p, combatMessage("{0} 被围墙吞没", p), { type: "kill" });
}

function burn(ctx: SimContext, p: Player, amount: number) {
  const s = ctx.state;
  // Whole points only, so health stays an integer; the remainder carries to the next tick.
  const owed = (ctx.zoneBurn.get(p.id) ?? 0) + amount,
    damage = Math.min(p.hp, Math.floor(owed));
  ctx.zoneBurn.set(p.id, owed - Math.floor(owed));
  if (!damage) return;
  p.hp -= damage;
  cancelBuild(p);
  if (ctx.healthCaps.has(p.id)) ctx.healthCaps.set(p.id, p.hp);
  const last = ctx.zoneBurnEventAt.get(p.id) ?? -Infinity;
  if (p.hp > 0 && s.time - last >= BURN_EVENT_INTERVAL) {
    ctx.zoneBurnEventAt.set(p.id, s.time);
    emit(ctx, p, "被火场灼烧", { type: "hurt", blocked: false });
  }
  if (p.hp <= 0) {
    p.alive = false;
    p.offers = [];
    emit(ctx, p, combatMessage("{0} 被火场吞没", p), { type: "kill" });
  }
}
