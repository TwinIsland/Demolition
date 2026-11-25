import { EQUIPMENT_SLOTS, ITEMS, isEquipment } from "./content";
import type { Equipment, GameSnapshot, Player, Vec2 } from "./types";

// Defaults for smoke snapshots created before per-cloud parameters were added.
export const DEFAULT_SMOKE = { duration: 6, radius: 1.65 };
export const throwReach = (id: Equipment) => ITEMS[id]?.throwable?.reach ?? 0;
export function canEquip(p: Player, id: Equipment) {
  return (
    id === "bomb" ||
    Boolean(ITEMS[id] && isEquipment(ITEMS[id]) && (ITEMS[id].permanent || p.inventory[id] > 0))
  );
}
export function cycleEquipment(p: Player, steps: number, current = p.equipped): Equipment {
  const available = EQUIPMENT_SLOTS.filter((id) => canEquip(p, id));
  const index = Math.max(0, available.indexOf(current));
  return available[(((index + steps) % available.length) + available.length) % available.length];
}
export function obscured(s: Readonly<GameSnapshot>, from: Vec2, to: Vec2) {
  const dx = to.x - from.x,
    dz = to.z - from.z,
    length = dx * dx + dz * dz;
  return s.smoke.some((c) => {
    const t = length ? Math.max(0, Math.min(1, ((c.x - from.x) * dx + (c.z - from.z) * dz) / length)) : 0;
    return Math.hypot(from.x + t * dx - c.x, from.z + t * dz - c.z) < (c.radius ?? DEFAULT_SMOKE.radius);
  });
}
