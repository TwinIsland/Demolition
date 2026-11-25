import { blastCells, laneDistances } from "./geometry";
import { lootContext, supplyDrop } from "./loot";
import type { GameSnapshot, Item } from "./types";

export const supplyInterval = (random: () => number) => 8 + 6 * random();

export function fieldSupply(state: GameSnapshot, random: () => number, nextId: () => number): Item | undefined {
  if (state.items.filter(item => item.source === "field").length >= 3) return;
  const distances = laneDistances(state,state.players.filter(p => p.alive));
  const occupied = new Set<number>();
  for (const p of [...state.zombies,...state.items,...state.blasts,...state.thrown]) {
    occupied.add(Math.round(p.z) * state.size + Math.round(p.x));
  }
  for (const bomb of state.bombs)
    for (const cell of blastCells(state,bomb)) occupied.add(cell.z * state.size + cell.x);
  const candidates: number[] = [];
  for (let i = 0; i < distances.length; i++) {
    if (distances[i] >= 2 && !occupied.has(i)) candidates.push(i);
  }
  if (!candidates.length) return;
  const k = candidates[Math.floor(random() * candidates.length)];
  const position = { x:k % state.size, z:Math.floor(k / state.size) };
  const kind = supplyDrop(lootContext(state,position),random);
  if (kind) return { id:nextId(), kind, source:"field", ...position };
}
