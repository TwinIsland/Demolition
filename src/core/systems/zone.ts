import { combatMessage } from "../combat-message";
import { RULES } from "../content";
import { DIRECTIONS } from "../maps";
import { ringOf, zoneAdvance, zoneAt, zoneWallInset } from "../zone";
import { matchStats, type GameSnapshot, type Player, type Vec2 } from "../types";
import { removeBuiltCrate } from "./building";
import { explode } from "./bombs";
import type { SimContext } from "./context";
import { emit } from "./events";

/** Seconds between "hurt" events for a player standing in zone fire. */
const BURN_EVENT_INTERVAL = 0.6;

/**
 * Advances the closing safe zone. The boundary wall moves inward one ring at a time: a ring that
 * closes becomes solid wall. Obstacles on its route and inner escape lane are cleared before the
 * advance; operators and zombies touching its moving face are carried inward unharmed, and loot
 * is lost only where the wall itself will stand. Once the zone is at its
 * smallest and the hold has passed, the remaining square burns and nobody can gain health back.
 */
export function stepZone(ctx: SimContext, dt: number) {
  const s = ctx.state;
  if (s.mode === "practice" || (s.story && !s.storyBrawl)) return;
  const before = s.zone?.closed ?? 0,
    cleared = s.zone?.clearingRing;
  const zone = (s.zone = zoneAt(s.size, s.time, s.duration));
  for (let ring = before + 1; ring <= zone.closed; ring++) {
    // Catch-up ticks must still clear each route before moving its boundary.
    clearRoute(ctx, ring);
    closeRing(ctx, ring);
  }
  if (zone.clearingRing !== undefined) {
    // Keep the lane clear even if a thrown/sliding charge arrived after the initial demolition.
    clearRoute(ctx, zone.clearingRing, cleared !== zone.clearingRing);
    if (zoneAdvance(s.time, zone) > 0) pushPlayers(s, zoneWallInset(s.time, zone));
    ctx.undead.carry(s, zone.clearingRing, zoneWallInset(s.time, zone));
  }

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

/**
 * Demolishes what would block the swept ring and its inner escape lane before the boundary moves.
 * No loot or score. Zombies and items block nothing: zombies are carried inward by the wall, and
 * only items on the ring that turns into wall are lost.
 */
function clearRoute(ctx: SimContext, ring: number, notify = false) {
  const s = ctx.state,
    size = s.size;
  let changed = notify;
  const demolition = new Set<number>();
  for (let z = 0; z < size; z++)
    for (let x = 0; x < size; x++) {
      const depth = ringOf(size, { x, z });
      if (depth !== ring && depth !== ring + 1) continue;
      demolition.add(z * size + x);
      // Village buildings occupy several solid cells. Demolish the whole footprint together,
      // so losing an outer wall cannot leave invisible collision cells inside a roofless shell.
      if (s.tiles[z][x] !== 1) continue;
      const [kind, footprint, part] = (ctx.map.featureAt?.(x, z, size) ?? "").split(":");
      if (!footprint || !part || !["farmhouse", "dojo", "shop", "cottage", "shrine"].includes(kind)) continue;
      const [columns, rows] = footprint.split("x").map(Number);
      const [column, row] = part.split(",").map(Number);
      for (let bz = z - row; bz < z - row + rows; bz++)
        for (let bx = x - column; bx < x - column + columns; bx++)
          if (ringOf(size, { x: bx, z: bz }) > (s.zone?.closed ?? 0)) demolition.add(bz * size + bx);
    }
  for (const cell of demolition) {
    const x = cell % size,
      z = Math.floor(cell / size);
    if (s.tiles[z][x] === 0) continue;
    changed = true;
    if (s.tiles[z][x] === 2) {
      delete s.coverDamage?.[s.coverOrigins?.[cell] ?? cell];
      delete s.coverOrigins?.[cell];
      removeBuiltCrate(s, x, z);
    }
    s.tiles[z][x] = 0;
    delete s.wallOrigins?.[cell];
  }
  const swept = (p: Vec2) => ringOf(size, p) <= ring + 1;
  s.bombs = s.bombs.filter((bomb) => !swept(bomb));
  s.thrown = s.thrown.filter((item) => !swept(item));
  s.items = s.items.filter((item) => ringOf(size, item) > ring);
  if (changed) {
    s.coverRevision = (s.coverRevision ?? 0) + 1;
    ctx.undead.terrainChanged(s.time);
  }
}

/** Settles the moving boundary on the grid after its horizontal advance. */
function closeRing(ctx: SimContext, ring: number) {
  const s = ctx.state,
    size = s.size;
  for (let z = 0; z < size; z++)
    for (let x = 0; x < size; x++) if (ringOf(size, { x, z }) === ring) s.tiles[z][x] = 1;
  reconnect(s, ring);
  pushPlayers(s, ring + 0.5);
  ctx.undead.carry(s, ring, ring + 0.5);
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

/**
 * Carries bodies with the wall's inner face. The swept ring and escape lane are already empty,
 * so even corner pushes remain local and never travel through interior obstacles.
 */
function pushPlayers(s: GameSnapshot, inset: number) {
  const min = inset + RULES.playerRadius + 1e-6,
    max = s.size - 1 - min;
  for (const p of s.players) {
    if (!p.alive) continue;
    const x = Math.max(min, Math.min(max, p.x)),
      z = Math.max(min, Math.min(max, p.z));
    if (x === p.x && z === p.z) continue;
    p.x = x;
    p.z = z;
    delete p.kickPush;
  }
}

function burn(ctx: SimContext, p: Player, amount: number) {
  const s = ctx.state;
  // Whole points only, so health stays an integer; the remainder carries to the next tick.
  const owed = (ctx.zoneBurn.get(p.id) ?? 0) + amount,
    damage = Math.min(p.hp, Math.floor(owed));
  ctx.zoneBurn.set(p.id, owed - Math.floor(owed));
  if (!damage) return;
  p.hp -= damage;
  matchStats(p).damageTaken += damage;
  if (ctx.healthCaps.has(p.id)) ctx.healthCaps.set(p.id, p.hp);
  const last = ctx.zoneBurnEventAt.get(p.id) ?? -Infinity;
  if (p.hp > 0 && s.time - last >= BURN_EVENT_INTERVAL) {
    ctx.zoneBurnEventAt.set(p.id, s.time);
    emit(ctx, p, "被火场灼烧", { type: "hurt", blocked: false });
  }
  if (p.hp <= 0) {
    p.alive = false;
    matchStats(p).diedAt = s.time;
    p.offers = [];
    emit(ctx, p, combatMessage("{0} 被火场吞没", p), { type: "kill" });
  }
}
