import * as v from "valibot";
import { baseConfigEntries, hook } from "./common";

export const MutationDefinitionSchema = v.object({
  ...baseConfigEntries,
  apply: hook,
  eligible: v.optional(hook),
});
