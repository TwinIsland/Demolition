import { combatMessage } from "../combat-message";
import { isEquipment, ITEMS } from "../content";
import { SUPPLY, supplyCost } from "../economy";
import type { GameSnapshot, ItemId, Player } from "../types";
import type { SimContext } from "./context";
import { emit } from "./events";

export type SupplyRefusal = "unavailable" | "cooldown" | "full" | "coins";

/** Items the supply shop sells, cheapest first. Any equipment module with a `price` is listed. */
export const SUPPLY_CATALOG: readonly ItemId[] = Object.values(ITEMS)
  .filter((item) => item.price !== undefined && isEquipment(item) && !item.permanent)
  .sort((a, b) => a.price! - b.price! || a.id.localeCompare(b.id, "en"))
  .map((item) => item.id);

/** What the next unit of an item costs this player. */
export const supplyPrice = (p: Readonly<Player>, id: ItemId) =>
  supplyCost(ITEMS[id]?.price ?? 0, p.supplyBought?.[id] ?? 0);

/** Why a purchase would be turned down right now, or undefined when it would go through. */
export function supplyRefusal(
  s: Readonly<GameSnapshot>,
  p: Readonly<Player>,
  id: ItemId,
): SupplyRefusal | undefined {
  if (!SUPPLY_CATALOG.includes(id) || !p.alive || s.phase !== "playing" || s.zone?.final)
    return "unavailable";
  if ((p.supplyReadyAt ?? 0) > s.time) return "cooldown";
  if ((p.inventory[id] ?? 0) >= SUPPLY.carryLimit) return "full";
  if (p.credits < supplyPrice(p, id)) return "coins";
  return undefined;
}

/** Sells one unit into the inventory. The match does not pause; the buyer keeps moving. */
export function buySupply(ctx: SimContext, p: Player, id: ItemId) {
  const s = ctx.state;
  if (supplyRefusal(s, p, id)) return;
  p.credits -= supplyPrice(p, id);
  p.inventory[id] = (p.inventory[id] ?? 0) + 1;
  (p.supplyBought ??= {})[id] = (p.supplyBought[id] ?? 0) + 1;
  p.supplyReadyAt = s.time + SUPPLY.cooldown;
  emit(ctx, p, combatMessage("购买{0}", ITEMS[id]), { type: "pickup", item: id });
}
