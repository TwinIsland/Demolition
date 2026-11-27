import { mutations } from "#game-catalog";
import { indexPacks } from "./pack-api";
import { assertValid, MutationDefinitionSchema } from "./schema";
import type { MutationId, Player } from "./types";

for (const mutation of mutations) assertValid("mutation", MutationDefinitionSchema, mutation);
export const MUTATIONS = indexPacks(mutations, "mutation");
const pool = Object.values(MUTATIONS);

export function grantMutation(p: Player, random: () => number, preferred?: MutationId) {
  const useful = pool.filter((m) => !m.eligible || m.eligible(p));
  const choices = useful.length ? useful : pool;
  const fixed = preferred ? MUTATIONS[preferred] : undefined;
  const mutation =
    fixed && (!fixed.eligible || fixed.eligible(p)) ? fixed : choices[Math.floor(random() * choices.length)];
  mutation.apply(p);
  const owned: Record<MutationId, number> = (p.mutations ??= {});
  owned[mutation.id] = (owned[mutation.id] ?? 0) + 1;
  return mutation;
}
