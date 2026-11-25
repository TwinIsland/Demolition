import { zoneBurning } from "./zone";
import { ITEMS, modifiedStat } from "./content";
import { throwReach } from "./equipment";
import { TILE_SIZE } from "./geometry";
import type { Equipment, GameSnapshot, Player, ThrowMode, Vec2 } from "./types";

export const placementRadius = (p: Player, time = 0) => modifiedStat(p, "placementRadius", 2, time);
export const canLob = (equipment: Equipment) => ITEMS[equipment]?.throwable?.trajectory === "lob";

function reach(p: Player, equipment: Equipment, time: number, mode: ThrowMode) {
  return mode === "lob" && canLob(equipment) ? throwReach(equipment) : placementRadius(p, time);
}

// First-person sight line intersects the floor; horizontal aim selects maximum reach.
export function aimCell(
  p: Player,
  yaw: number,
  pitch: number,
  equipment: Equipment = p.equipped,
  time = 0,
  mode: ThrowMode = "direct",
): Vec2 {
  const radius = reach(p, equipment, time, mode);
  const eyeHeight = 0.65 + (p.elevation ?? 0) / TILE_SIZE;
  const distance = pitch < 0 ? Math.min(radius, eyeHeight / Math.tan(-pitch)) : radius;
  const dx = -Math.sin(yaw) * distance,
    dz = -Math.cos(yaw) * distance;
  const ox = Math.round(p.x),
    oz = Math.round(p.z);
  const x = Math.round(p.x + dx),
    z = Math.round(p.z + dz);
  if (Math.hypot(x - ox, z - oz) > radius) {
    // Choose the closest in-range neighbor when rounding crosses the circular boundary.
    const candidates = [
      { x: x - Math.sign(x - ox), z },
      { x, z: z - Math.sign(z - oz) },
      { x: x - Math.sign(x - ox), z: z - Math.sign(z - oz) },
    ].filter((c) => Math.hypot(c.x - ox, c.z - oz) <= radius);
    candidates.sort(
      (a, b) => Math.hypot(a.x - p.x - dx, a.z - p.z - dz) - Math.hypot(b.x - p.x - dx, b.z - p.z - dz),
    );
    return candidates[0];
  }
  return { x, z };
}

export function canPlace(
  s: Readonly<GameSnapshot>,
  p: Player,
  target: Vec2,
  equipment: Equipment = "bomb",
  mode: ThrowMode = "direct",
) {
  if (equipment !== "bomb" && !ITEMS[equipment]?.throwable) return false;
  const { x, z } = target;
  const dx = x - Math.round(p.x),
    dz = z - Math.round(p.z);
  if (
    !Number.isInteger(x) ||
    !Number.isInteger(z) ||
    Math.hypot(dx, dz) > reach(p, equipment, s.time, mode) ||
    s.tiles[z]?.[x] !== 0 ||
    // Nothing lands in zone fire: a bomb there would be an instant detonation with no fuse.
    (s.zone && zoneBurning(s.size, target, s.zone))
  )
    return false;
  if (mode === "lob") return canLob(equipment) && p.inventory[equipment] > 0;
  if (s.bombs.some((b) => b.x === x && b.z === z)) return false;
  if (equipment === "bomb")
    return s.bombs.filter((b) => b.ownerId === p.id && b.source !== "throwable").length < p.capacity;
  // Low throws travel through each intervening cell.
  let cx = Math.round(p.x),
    cz = Math.round(p.z),
    ix = 0,
    iz = 0;
  while (cx !== x || cz !== z) {
    const cross = (1 + 2 * ix) * Math.abs(dz) - (1 + 2 * iz) * Math.abs(dx);
    if (cross === 0 && (s.tiles[cz][cx + Math.sign(dx)] || s.tiles[cz + Math.sign(dz)][cx])) return false;
    if (cross <= 0) {
      cx += Math.sign(dx);
      ix++;
    }
    if (cross >= 0) {
      cz += Math.sign(dz);
      iz++;
    }
    if (s.tiles[cz][cx] !== 0) return false;
  }
  return p.inventory[equipment] > 0;
}
