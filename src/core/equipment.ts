import { EQUIPMENT_SLOTS, ITEMS, isEquipment } from "./content";
import type { Equipment, Player } from "./types";

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
