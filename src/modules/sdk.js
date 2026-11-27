// Stable ES module entry shared by source packs and installed release packs.
// Packs import this while the catalog is still loading, so nothing exported here may reach a module that reads
// the catalog at import time (`core/maps.ts`, `core/content.ts` and the other registries).
export { defineItem, defineMutation, definePerk, defineSkill } from "../core/module-api.ts";
export { defineFinish, defineMap, defineObstacle, defineSkin } from "../core/pack-api.ts";
export { linkedBombs } from "../core/geometry.ts";
export { inTacticalView } from "../core/types.ts";
