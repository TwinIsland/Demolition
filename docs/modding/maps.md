# Map mods

A map is one `defineMap` call in `maps/<id>/index.js`. Types are in `src/core/pack-api.ts`, generation in `src/core/maps.ts`, obstacle presets in `src/core/obstacles.ts`. The four built-in maps are complete examples:

| Map | ID | Size | Notes |
| --- | --- | --- | --- |
| Outpost | `dream-garden` | 19 × 19 | Rain, concrete outpost |
| Rainforest | `rainforest` | 31 × 31 | Grass and mud ground, temple ruins in the centre, inset spawns, longer zone timer |
| Warehouse | `night-lab` | 17 × 17 | Night, close quarters |
| Pool | `poolrooms` | 21 × 21 | Indoor tiled hall, shallow pools kept open, columns on a fixed grid |
| Backrooms | `backrooms` | 21 × 21 | Windowless office floor: fixed partitions and doorways in four-fold symmetry, carpet, low ceiling of light panels; stray walls and furniture move every 32 s after a 4 s warning |

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
| `terrainShift` | `{ every, warning }` in seconds. The map rearranges itself on that interval, after a countdown of `warning` seconds (default 4) during which the HUD counts down and the lights stutter. Needs `randomizeTerrain`; add `wallShuffle` for walls to move. Used by Backrooms |
| `theme` | `"garden"` (daylight, outdoor), `"midnight"` (night, industrial), `"rainforest"` (grass ground, forest scenery, tree and rock walls) or `"poolrooms"` (white tile hall under a ceiling of light panels, shallow water, walls on every fourth cell become columns) or `"backrooms"` (yellow papered walls up to a low suspended ceiling with a light panel over every second cell, one carpet across the floor; meant for a size whose middle cell is an even number of cells from the edge, such as 21) |
| `weather` | `"clear"` (default), `"rain"`, `"monsoon"` (rain with thicker, greener mist) `"indoor"` (no sky or rain, wet reflective floor) or `"office"` (dim windowless floor, damp patches in the carpet). Presentation only |
| `spawnInset` | Cells between the boundary wall and each of the four spawns, measured along the diagonal. Default 1, the corners. Use a larger value on big maps so operators meet sooner |
| `zoneScale` | Multiplier on the match length chosen in the room. Default 1. A map with many rings needs more time per match |
| `obstacles` | Weighted pool of cover models. Defaults to the `storage` set |
| `bgm` | Music URL for this map |
| `artwork`, `backdrop` | Card image on the map picker and full-screen background. `backdrop` falls back to `artwork`, and with neither the live 3D map is shown |
| `minimap` | Square top-down ground painting drawn under the radar's walls and markers. A built-in map needs no entry: put `minimap.webp` (or `.png`, `.jpg`) next to its `index.js`. Without it the radar draws a surface in the theme's colours |
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

## Large maps

`size` has to be odd, because the zone ends on the centre 3 × 3. Rainforest is 31 × 31: 29 × 29 playable cells, 2.7 times the area of Outpost. Three settings keep a map of that size playable:

- `spawnInset: 7` starts the operators about 16 cells apart instead of 28. The outer rings are left for looting.
- `zoneScale: 5 / 3` gives 13 rings about 22 s each at the default duration, close to the pace of Outpost.
- Fixed lanes from `tileAt` (two trails, a creek and the temple gates) guarantee routes to the centre.

Bots steer by walking distance to the nearest known opponent on maps of 23 cells or more, because the fight is often outside their local route search. Smaller maps keep the straight-line estimate.

The renderer batches a map larger than 21 cells in a 3 × 3 grid of chunks, so the camera only draws the chunks in view, and stretches the sun's shadow map over the whole grid.

## Ground

`groundAt(x, z, size)` in the layout object tells the engine what each cell's ground is: `"slab"`, `"stone"`, `"grass"`, `"mud"`, `"water"` or `"carpet"`. It selects the footstep sound (hard, grass, mud, splash or carpet). On a `rainforest` map it also drives the look: grass and mud are blended into one continuous ground, and `"stone"` cells are paved. On a `poolrooms` map, `"water"` cells have no deck: the pool lining and its water show instead, so keep them open in `tileAt`, because obstacles stand at deck height. Without it, a `rainforest` map is all grass and the other themes are all slab.

```js
groundAt(x, z, size) {
  if (z === (size - 1) / 2) return "mud"; // a muddy trail through the middle
  return "grass";
},
```

`groundAt` must be a pure function of the cell: it is called by the renderer and the audio layer, not by the simulation.

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
| `fern` | soft | 1.6 | rainforest |
| `banana` | soft | 3 | rainforest |
| `boulder` | metal | 1.5 | rainforest |
| `fallen-log` | wood | 1.3 | rainforest |
| `ruin-pillar` | metal | 2.3 | rainforest, ruins |
| `idol` | metal | 2.1 | rainforest, ruins |
| `swim-rings` | soft | 1.25 | poolrooms |
| `lifeguard-chair` | metal | 2.4 | poolrooms |
| `locker` | metal | 2.05 | poolrooms |
| `planter` | soft | 1.9 | poolrooms |
| `towel-cart` | soft | 1.5 | poolrooms |
| `cardboard-boxes` | soft | 1.55 | backrooms, office |
| `filing-cabinet` | metal | 1.88 | backrooms, office |
| `office-desk` | wood | 1.35 | backrooms, office |
| `water-cooler` | soft | 1.52 | backrooms, office |
| `partition` | soft | 1.63 | backrooms, office |

`built-crate` is reserved for crates built by players and is never drawn from a pool.

Rules for your own model:

- The GLB stands on y = 0, is centred on its tile and faces +Z.
- It is scaled uniformly to fit `footprint × 2.4` world units wide (default 0.86, clamped to 0.5–0.95) and `height` units tall (default 2). A wall is 2.5 tall.
- `surface` is `wood`, `metal` or `soft` and selects the knife impact sound. It defaults to `metal`.
- Fill most of the tile, so players can see at a glance that it is blocked.
- A material named `df:<name>` is replaced with the engine's shared material of that name, so your model matches the built-in ones. The names are listed in `PALETTE` in `src/render/materials.ts`, for example `df:planks`, `df:steel`, `df:paint-olive`, `df:concrete`, `df:moss-rock`, `df:ruin-stone`, `df:leaf`.

An unknown preset or set logs a warning and is skipped. An empty pool falls back to `set:storage`. The older `covers: [{ kind, weight }]` field still works and is read as preset IDs.

To add a preset for every map, call `defineObstacle({ id, model, surface, height, footprint, tags })` in `src/core/obstacles.ts`. Built-in models are generated by `tools/model-forge`. Stone obstacles use the `metal` surface, which is the hard-impact knife sound.

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
