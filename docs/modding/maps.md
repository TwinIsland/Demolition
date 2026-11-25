# Map mods

A map is one `defineMap` call in `maps/<id>/index.js`. Types are in `src/core/pack-api.ts`, generation in `src/core/maps.ts`, obstacle presets in `src/core/obstacles.ts`. The two built-in maps, `dream-garden` (Outpost) and `night-lab` (Warehouse), are complete examples.

## Setup

```js
import { defineMap } from "../../sdk.js";

export default defineMap(
  {
    id: "rail-yard",
    name: "调车场",
    subtitle: "15 × 15 · 小型场地",
    translations: { en: { name: "Rail Yard", subtitle: "15 × 15 · Small arena" } },
    size: 15,
    density: 0.7,
    wallDensity: 0.25,
    theme: "midnight",
    obstacles: [
      { use: "crate", weight: 20 },
      { use: "set:industrial", weight: 40 },
    ],
  },
  {
    // Optional layout functions, see below.
    tileAt(x, z, size) {
      if (z === (size - 1) / 2) return 0; // keep the middle row open
    },
  },
);
```

| Field | Meaning |
| --- | --- |
| `size` | Tiles per side, border included. An odd integer, 7 or more |
| `density` | 0 to 1. Chance that an open interior tile starts with destructible cover |
| `wallDensity` | 0 to 1. Share of interior tiles turned into permanent walls. Omit for the classic pillar grid |
| `wallShuffle` | 0 to 1. Share of generated walls that move on a terrain reshuffle. Needs `wallDensity`. Default 0 |
| `theme` | `"garden"` (daylight, outdoor) or `"midnight"` (night, industrial) |
| `obstacles` | Weighted pool of cover models. Defaults to the `storage` set |
| `bgm` | Music URL for this map |
| `artwork`, `backdrop` | Card image on the map picker and full-screen background. `backdrop` falls back to `artwork`, and with neither the live 3D map is shown |
| `subtitle` | Line under the map name |

## Random generation

A match is generated from its seed, so the same seed gives the same map. Tiles are `0` floor, `1` wall, `2` destructible cover.

1. The border is wall.
2. Tiles within 2 steps (Manhattan distance) of the four corner spawns stay clear.
3. `tileAt(x, z, size, random)` may fix any other tile by returning `0`, `1` or `2`. Returning nothing leaves the tile to the generator.
4. With `wallDensity`: the remaining tiles are shuffled and `round(count × wallDensity)` of them become walls. A wall is only placed on a tile with at least 3 open neighbours, where it leaves every neighbour 2 exits and does not split the map. Fewer walls are placed if the rule runs out of valid tiles.
5. Each remaining open tile becomes cover with probability `density`.

During a match the boundary wall closes in ring by ring, so the centre of your map is where every match ends. Keep it playable. A larger `size` means more rings, each closing sooner after the last.

Without `wallDensity`, every tile with even `x` and even `z` is a wall (the classic grid) and step 5 applies to the rest.

Use `random()` inside `tileAt`, never `Math.random()`.

## Obstacles

Every destructible tile shows one obstacle model drawn by weight from the map's `obstacles` pool. The choice is cosmetic: all obstacles block a full tile and share the same durability, score and loot. The draw is seeded per tile, so it is stable for a given match seed.

```js
obstacles: [
  { use: "crate", weight: 20 },            // one preset
  { use: "set:industrial", weight: 40 },   // a whole set; the weight is split evenly between its members
  { model: new URL("./generator.glb", import.meta.url).href, weight: 10,
    surface: "metal", height: 2, footprint: 0.86 },   // your own model
],
```

Presets are defined in `src/core/obstacles.ts`:

| Preset | Surface | Height | Sets |
| --- | --- | --- | --- |
| `crate` | wood | 1.9 | storage, warehouse, outpost |
| `pallet` | wood | 1.72 | storage, warehouse |
| `drum` | metal | 1.5 | storage, warehouse, outpost |
| `bags` | soft | 1.45 | fortification, outpost |
| `hesco` | soft | 1.85 | fortification, outpost |
| `barricade` | metal | 1.5 | fortification, warehouse, outpost |
| `press` | metal | 2.1 | industrial, warehouse |
| `hopper` | metal | 2.1 | industrial, warehouse |
| `valve` | metal | 1.7 | industrial, warehouse |
| `robot-arm` | metal | 2.3 | industrial, warehouse |
| `oak` | wood | 3.3 | woodland, outpost |
| `pine` | wood | 3.6 | woodland, outpost |
| `logs` | wood | 1.6 | woodland, outpost |

`built-crate` is reserved for crates built by players and is never drawn from a pool.

Rules for your own model:

- The GLB stands on y = 0, is centred on its tile and faces +Z.
- It is scaled uniformly to fit `footprint × 2.4` world units wide (default 0.86, clamped to 0.5–0.95) and `height` units tall (default 2). A wall is 2.5 tall.
- `surface` is `wood`, `metal` or `soft` and selects the knife impact sound. It defaults to `metal`.
- Fill most of the tile, so players can see at a glance that it is blocked.
- A material named `df:<name>` is replaced with the engine's shared material of that name, so your model matches the built-in ones. The names are listed in `PALETTE` in `src/render/materials.ts`, for example `df:planks`, `df:steel`, `df:paint-olive`, `df:concrete`.

An unknown preset or set logs a warning and is skipped. An empty pool falls back to `set:storage`. The older `covers: [{ kind, weight }]` field still works and is read as preset IDs.

To add a preset for every map, call `defineObstacle({ id, model, surface, height, footprint, tags })` in `src/core/obstacles.ts`. Built-in models are generated by `tools/model-forge`.

## Terrain reshuffle

Implement `randomizeTerrain(random, size)` to enable the Practice-mode reshuffle and the [Cataclysm](../content/perks/apocalypse.md) perk on your map. It returns layout preferences for the new arrangement, usually a `tileAt` that returns `0` for lanes to keep open:

```js
randomizeTerrain(random, size) {
  const lane = 3 + Math.floor(random() * (size - 6));
  return { tileAt: (x, z) => (x === lane ? 0 : undefined) };
},
```

The engine then moves every surviving piece of cover to a new tile:

- Pieces keep their model, rotation and knife damage. The number of pieces does not change.
- Walls, spawn zones, tiles under operators and zombies, their open neighbouring tiles, crates built by players, and tiles with items, charges or fire are left alone.
- Tiles your `tileAt` marks `0` or `1` are used only when no other tile is free.
- With `wallShuffle`, that share of the generated walls moves too. Border walls and walls fixed by `tileAt` never move. Moved walls follow the generation rule, so the map stays connected, and never land on or next to an operator or zombie.

Source: `src/core/rearrange-cover.ts`.
