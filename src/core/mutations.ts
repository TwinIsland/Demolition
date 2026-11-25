import { mutations } from "#game-catalog";
import { indexPacks } from "./pack-api";
import type { Player } from "./types";

export const MUTATIONS = indexPacks(mutations,"mutation");
const pool = Object.values(MUTATIONS);

export function grantMutation(p:Player, random:()=>number) {
  const mutation = pool[Math.floor(random()*pool.length)];
  mutation.apply(p);
  const owned: Record<string, number> = p.mutations ??= {};
  owned[mutation.id] = (owned[mutation.id] ?? 0) + 1;
  return mutation;
}
