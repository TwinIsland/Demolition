/**
 * Destructible obstacle presets.
 *
 * One definition carries everything the engine needs to know about an obstacle:
 * the model, how large it stands inside its tile and what it is made of. Maps
 * only reference presets by ID, so every map draws from the same catalogue.
 */

/** Selects strike sounds and debris. */
export type ObstacleSurface = "wood" | "metal" | "soft";

export interface ObstacleDefinition {
  /** Lower-case ID, unique among presets. */
  id: string;
  /** GLB path. The model stands on y = 0, is centred on its tile and faces +Z. */
  model: string;
  surface: ObstacleSurface;
  /** Display height in world units. A tile is 2.4 units wide and a wall is 2.5 tall. */
  height: number;
  /** Fraction of the tile width the model may fill, 0.5 – 0.95. Defaults to 0.86. */
  footprint?: number;
  /** Free-form groups used by `set:<tag>` references. */
  tags?: readonly string[];
}

/** An obstacle after map references have been resolved, as renderers and the simulation see it. */
export interface Obstacle extends Required<Omit<ObstacleDefinition, "tags">> {
  weight: number;
}

/** A weighted entry in a map's obstacle pool. */
export type MapObstacle = { weight: number } & (
  | {
      /** A preset ID, or `set:<tag>` for every preset carrying that tag. */ use: string;
    }
  | (Omit<ObstacleDefinition, "id" | "tags" | "height" | "surface"> & {
      height?: number;
      surface?: ObstacleSurface;
    })
);

export const DEFAULT_FOOTPRINT = 0.86;
const registry = new Map<string, ObstacleDefinition>();

export function defineObstacle(definition: ObstacleDefinition) {
  if (!/^[a-z][a-z0-9-]*$/.test(definition.id)) throw new Error(`Invalid obstacle ID: ${definition.id}`);
  if (registry.has(definition.id)) throw new Error(`Duplicate obstacle ID: ${definition.id}`);
  if (!(definition.height > 0)) throw new Error(`Obstacle ${definition.id} needs a positive height`);
  registry.set(definition.id, Object.freeze({ ...definition }));
  return definition;
}

const preset = (id: string, surface: ObstacleSurface, height: number, tags: string[], footprint?: number) =>
  defineObstacle({
    id,
    surface,
    height,
    tags,
    footprint,
    model: `./assets/obstacles/${id}.glb`,
  });

// Storage
preset("crate", "wood", 1.9, ["storage", "warehouse", "outpost"]);
/** Built by players during a match; never drawn from a map pool. */
export const BUILT_CRATE = "built-crate";
preset(BUILT_CRATE, "wood", 1.9, []);
preset("pallet", "wood", 1.72, ["storage", "warehouse"]);
preset("drum", "metal", 1.5, ["storage", "warehouse", "outpost"]);
// Fortification
preset("bags", "soft", 1.45, ["fortification", "outpost"], 0.84);
preset("hesco", "soft", 1.85, ["fortification", "outpost"]);
preset("barricade", "metal", 1.5, ["fortification", "warehouse", "outpost"]);
// Industrial
preset("press", "metal", 2.1, ["industrial", "warehouse"]);
preset("hopper", "metal", 2.1, ["industrial", "warehouse"]);
preset("valve", "metal", 1.7, ["industrial", "warehouse"]);
preset("robot-arm", "metal", 2.3, ["industrial", "warehouse"]);
// Woodland
preset("oak", "wood", 3.3, ["woodland", "outpost"]);
preset("pine", "wood", 3.6, ["woodland", "outpost"]);
preset("logs", "wood", 1.6, ["woodland", "outpost"]);

// Rainforest
preset("fern", "soft", 1.6, ["rainforest"], 0.9);
preset("banana", "soft", 3, ["rainforest"], 0.92);
preset("boulder", "metal", 1.5, ["rainforest"], 0.9);
preset("fallen-log", "wood", 1.3, ["rainforest"], 0.92);
preset("ruin-pillar", "metal", 2.3, ["rainforest", "ruins"]);
preset("idol", "metal", 2.1, ["rainforest", "ruins"], 0.9);

// Poolrooms
preset("swim-rings", "soft", 1.25, ["poolrooms"], 0.8);
preset("lifeguard-chair", "metal", 2.4, ["poolrooms"], 0.7);
preset("locker", "metal", 2.05, ["poolrooms"], 0.88);
preset("planter", "soft", 1.9, ["poolrooms"], 0.92);
preset("towel-cart", "soft", 1.5, ["poolrooms"], 0.8);

// Backrooms
preset("cardboard-boxes", "soft", 1.55, ["backrooms", "office"]);
preset("filing-cabinet", "metal", 1.88, ["backrooms", "office"]);
preset("office-desk", "wood", 1.35, ["backrooms", "office"]);
preset("water-cooler", "soft", 1.52, ["backrooms", "office"], 0.6);
preset("partition", "soft", 1.63, ["backrooms", "office"]);

/** IDs accepted by maps written for earlier releases. */
const LEGACY_IDS: Readonly<Record<string, string>> = { "low-bags": "bags" };
const FALLBACK: readonly MapObstacle[] = [{ use: "set:storage", weight: 1 }];

export const obstaclePresets = (): readonly ObstacleDefinition[] => [...registry.values()];
export const obstaclePreset = (id: string) => registry.get(LEGACY_IDS[id] ?? id);

const resolved = (definition: ObstacleDefinition, weight: number): Obstacle => ({
  id: definition.id,
  model: definition.model,
  surface: definition.surface,
  height: definition.height,
  footprint: Math.min(0.95, Math.max(0.5, definition.footprint ?? DEFAULT_FOOTPRINT)),
  weight,
});

/**
 * Expand a map's pool into concrete obstacles. Unknown references are reported
 * and skipped; a pool that ends up empty falls back to the storage set.
 */
export function resolveObstacles(entries: readonly MapObstacle[] | undefined, mapId = "map"): Obstacle[] {
  const pool: Obstacle[] = [];
  for (const entry of entries ?? []) {
    if (!Number.isFinite(entry.weight) || entry.weight <= 0) continue;
    if (!("use" in entry)) {
      const height = entry.height ?? 2;
      pool.push(
        resolved(
          {
            ...entry,
            height,
            surface: entry.surface ?? "metal",
            id: `custom:${entry.model}:${height}:${entry.footprint ?? ""}`,
          },
          entry.weight,
        ),
      );
    } else if (entry.use.startsWith("set:")) {
      const tag = entry.use.slice(4);
      const members = obstaclePresets().filter((o) => o.tags?.includes(tag));
      if (!members.length) console.warn(`[${mapId}] Unknown obstacle set: ${entry.use}`);
      for (const member of members) pool.push(resolved(member, entry.weight / members.length));
    } else {
      const definition = obstaclePreset(entry.use);
      if (definition) pool.push(resolved(definition, entry.weight));
      else console.warn(`[${mapId}] Unknown obstacle preset: ${entry.use}`);
    }
  }
  return pool.length || entries === FALLBACK ? pool : resolveObstacles(FALLBACK, mapId);
}
