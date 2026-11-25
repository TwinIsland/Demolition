# Modding overview

All game content is a pack: one folder with an `index.js` entry. Built-in content uses the same API as mods.

| Category | Folder | Entry function | Guide |
| --- | --- | --- | --- |
| Maps | `maps` | `defineMap` | [Map mods](maps.md) |
| Items and throwables | `items` | `defineItem` | [Item mods](items.md) |
| Skills | `skills` | `defineSkill` | [Skill mods](skills.md) |
| Perks | `perks` | `definePerk` | [Perk mods](perks.md) |
| Mutations | `mutations` | `defineMutation` | [Other packs](other-packs.md) |
| Character skins | `skins` | `defineSkin` | [Other packs](other-packs.md) |
| Charge finishes | `bomb-finishes` | `defineFinish` | [Other packs](other-packs.md) |

Every built-in pack has a page in the [content reference](../content/README.md) and is a working example to copy.

## Where packs live

| Setup | Folder | Discovery |
| --- | --- | --- |
| Development (`npm run dev`) | `src/modules/<category>/<id>/` | The dev server scans the folders on each load |
| Release build | `dist/mods/<category>/<id>/` | `mods/manifest.json` |

To install a pack into a release, copy its folder into `mods/<category>/`, then either run `node mods/reindex.mjs` in the release folder or add the folder name to that category in `mods/manifest.json`. No rebuild is needed. The game must be served over HTTP.

## Pack rules

- The folder name and `id` use lower-case letters, digits and hyphens, and start with a letter. Use your own IDs: built-in folders are overwritten by game updates.
- Packs are native ES modules. Relative imports need the `.js` suffix.
- Import the API from the SDK: `import { defineItem } from "../../sdk.js";`
- Reference files in the pack with `new URL("./file.png", import.meta.url).href`.
- By convention numbers go in `config.js` and behaviour in `index.js`. Put tunable numbers under `stats` and read them from the behaviour.
- `order` sorts the pack in menus (default 100).
- Configs are validated at load against the schemas in `src/core/schema/`. An invalid config stops the game with an error naming the pack.

## Common config fields

Skills, items, perks and mutations share these (`BaseConfig` in `src/core/module-api.ts`):

| Field | Meaning |
| --- | --- |
| `id`, `name`, `description` | Required. `name` and `description` are the Chinese source text |
| `icon` | Required. A built-in icon name, see `src/ui/icons.ts` |
| `translations` | `{ en: { name, description, tag } }`. Missing fields fall back to the source text. Maps also translate `subtitle` |
| `sound` | Optional audio URL played when the local player uses the item, casts the skill or takes the perk |
| `stats` | Free-form numbers for your behaviour code |
| `order` | Sort order |

## Rules for behaviour code

The simulation is deterministic and must stay that way.

- Never call `Math.random()` or read the clock. Use the `time` and `dt` passed to hooks (simulation seconds).
- Change only the `player` and `state` objects you are given. Store your own per-player numbers in `player.moduleData`.
- Hooks run for bots and humans alike, 60 times a second for `onTick`. Keep them cheap.
