# Developer guide

For working on the game itself. To add content without touching the engine, start at the [modding overview](modding/README.md).

## Setup

Requires Node.js 20.19+ or 22.12+.

```sh
npm ci
npm run dev        # dev server on http://127.0.0.1:5173
```

| Script | Does |
| --- | --- |
| `npm run dev` | Vite dev server. Packs are loaded straight from `src/modules` |
| `npm run build` | Type-check, build the game to `dist/` and the wiki to `dist/wiki/` |
| `npm run build:game`, `build:wiki` | The two halves of the build |
| `npm run dev:wiki` | Live preview of the wiki |
| `npm run preview` | Serve `dist/` locally, with packs from `dist/mods` |
| `npm run build:pages` | Build game and wiki to `.pages-build/` for GitHub Pages |
| `npm run check` | Type-check, lint and format check. Run before handing work over |
| `npm run typecheck`, `lint`, `format`, `format:check` | The individual steps. `format` rewrites files with Prettier |

Run `npm test` for regression tests and `npm run check` for static checks. Also check gameplay changes by playing.

## Stack

TypeScript, Vite 7, Three.js 0.181 with pmndrs postprocessing and N8AO, Howler for audio, valibot for config validation, and skinview3d for Minecraft-format characters. Content packs are plain JavaScript ES modules so they can be dropped into a release without a build.

## Layout

| Path | Contents |
| --- | --- |
| `src/main.ts`, `src/app/` | Composition root, screen state machine, game loop, settings, asset preload |
| `src/core/` | The simulation and its rules. No DOM, no Three.js |
| `src/core/simulation.ts`, `systems/` | The step loop and one file per rule area: movement, bombs, combat, equipment, loot, progression, match |
| `src/core/types.ts` | The shared protocol: `PlayerInput`, `GameSnapshot`, `GameEvent`, `PlayerAgent`, `MatchSession` |
| `src/core/module-api.ts`, `pack-api.ts`, `schema/` | The modding API and its config schemas |
| `src/agents/` | Controllers: `KeyboardAgent` and `BotAgent` |
| `src/session/` | `LocalMatchSession` and the session factory |
| `src/render/` | Three.js scene, models, materials, effects, post-processing in `post/` |
| `src/ui/` | One view per surface (lobby, shop, HUD parts), composed by `GameUI` |
| `src/styles/` | CSS, with design tokens in `tokens.css` |
| `src/audio/`, `src/input/`, `src/feel/` | Sound behind the `Sound` facade, key bindings, feedback cues |
| `src/modules/` | Built-in content packs and the SDK entry `sdk.js` |
| `src/i18n.ts`, `src/locales/` | English and Chinese text |
| `public/assets/` | Shared textures, audio, fonts, obstacle models. Licences in `CREDITS.md` |
| `tools/model-forge/`, `tools/skin-forge/` | Generators for built-in models and character skins |
| `scripts/reindex.mjs` | Rebuilds `mods/manifest.json` in a release |

## How a match runs

```text
KeyboardAgent / BotAgent  →  PlayerInput
MatchSession.submit       →  Simulation.step(1/60)
GameSnapshot              →  GameRenderer, GameUI, Sound
```

- Agents propose inputs. Only `Simulation` changes health, positions or the map, and it validates every input.
- The snapshot is plain serialisable data. Renderer and UI read it and never write it.
- The simulation runs at a fixed 60 Hz. The renderer interpolates between steps.

The same seams are meant to carry online play later. See [Architecture](architecture.md).

### Determinism

A match is a pure function of its options, seed and inputs.

- Rules never call `Math.random()`, `Date.now()` or browser timers. They use the simulation's seeded generator (`seededRandom` in `core/maps.ts`) and `state.time`.
- UI animation may use real time. Damage, cooldowns and timers use simulation time.
- Pack hooks follow the same rule, see [Modding overview](modding/README.md#rules-for-behaviour-code).

### Content loading

`src/bootstrap.ts` loads the catalog before anything else is imported: it fetches `mods/manifest.json`, imports every pack's `index.js` in parallel, then starts the game. `core/content.ts` validates each definition against `core/schema/` and indexes skills, items and perks. A bad config fails loudly. Node tools use `catalog.node.ts`, which scans the folders directly. The two are switched by the `#game-catalog` import in `package.json`.

`npm run build` copies `src/modules/` to `dist/mods/`, bundles the SDK to `dist/mods/sdk.js` and writes the manifest.

## Where to change things

| To change | Look at |
| --- | --- |
| Health, damage, score, level thresholds | `core/combat.ts` |
| Fuse, base speed, starting coins | `RULES` in `core/content.ts` |
| Safe zone timing and damage | `core/zone.ts`, `core/systems/zone.ts` |
| Coins and crate building | `core/economy.ts`, `core/systems/building.ts` |
| Mode presets (Standard, Classic, Wild) | `core/match-modes.ts` |
| Perk tier weights and offer rules | `TIERS`, `rollPerks` in `core/content.ts` |
| Loot chances | `core/loot.ts`, `core/field-supplies.ts` |
| Zombies | `core/zombies.ts`, `ZOMBIE_STATS` in `core/loot.ts`, `ZOMBIE_RATES` in `core/room.ts` |
| Stamina and sprint | `core/stamina.ts` |
| Slide Kick feel | `KICK` in `core/geometry.ts` |
| A skill, item, perk or mutation | Its folder in `src/modules/` |
| Obstacle presets | `core/obstacles.ts` |
| Bot behaviour, personalities | `agents/bot-agent.ts`, `agents/tactics.ts` |
| What happens on a hit, a pickup, a level-up | The matching file in `core/systems/` |

After changing numbers, update [Game rules](game-rules.md) and [Probabilities](probabilities.md), and run `node docs/tools/build-content.mjs` to regenerate `docs/content/`.

## Bots

`BotAgent` sees the same snapshot as a human and returns the same `PlayerInput`. Each decision it:

1. takes a pending perk offer (highest `aiPriority`) and triggers active perks whose `aiShouldUse` is true;
2. scores reachable tiles for loot (`aiPickupValue`), cover to farm and opponents to hunt, weighted by its personality and a threat map;
3. picks a route that avoids predicted blasts, the closing zone, and tiles an opponent could seal with one charge (`BombForecast`, `safeRoute`, `likelyCharges`, `threatField`);
4. casts the ready skill with the highest `aiCastPriority`, and uses shield, bandage and knife when they apply;
5. otherwise throws a grenade or Molotov, builds a crate, or places a charge where the blast scores best and an escape route exists.

The helpers in `agents/tactics.ts` are pure functions of the snapshot, so replays stay deterministic.

**Personalities.** Each seat weighs those scores differently (`PERSONALITIES`), so the three bots play differently: MOMO hunts, MINT loots and farms, SUNNY is cautious and sets traps. Shop choices follow per-seat tastes with a seeded jitter.

**Hunt tokens.** Only the closest bot may hunt the human at a time (the closest two on Hard), so the human is not mobbed. Bots also lean toward the score leader.

**Difficulty** changes how well a bot decides, never health or damage (`BOT_SETTINGS`):

| Setting | Easy | Normal | Hard |
| --- | --- | --- | --- |
| Time between decisions | 0.48 s | 0.38–0.52 s | 0.18 s |
| Escape search depth | 5 | 7 | 10 |
| Attack options checked for a safe escape | 1 | 2 | 5 |
| Pause after an attack | 1.6 s | 1.45–1.67 s | 0.65 s |
| Aim time before a throw | 1.4 s | 1.3–1.48 s | 0.7 s |

Normal is the human-like setting: it only acts on what it can see, has to turn and aim, walks at 80% speed, and its timing varies per seat from the match seed. Hard is the optimiser.

**Adaptive** slides between Easy and a slightly slowed Hard (0.24 s decisions, 0.8 s pause) according to how the human is doing against the bots in health and score (`humanAdvantage`). It sees and aims like Normal.

Bots run behind the `PlayerAgent` interface. To try another policy, implement it and swap it in `session/create-session.ts`. If the policy is slow or asynchronous, cache its last decision and return that from `decide`.

## Wiki

The wiki is the Markdown in `docs/`, published with VitePress. The site config and theme are in `docs/.vitepress/`. The Wiki button in the game's top bar opens `wiki/` next to the game.

- `npm run dev:wiki` previews it with live reload. The game's own dev server does not serve the wiki, so the button only works in a build (`npm run build`, then `npm run preview`).
- Folder home pages are `README.md`, so they also read well on GitHub. The config rewrites them to `index`.
- `docs/content/` is generated by `node docs/tools/build-content.mjs`. A new module needs a behaviour entry in that script.
- New pages need a sidebar entry in `docs/.vitepress/config.mts`. Content pages are picked up automatically.
- VitePress needs an absolute base path. It is `/wiki/` by default and `/Demolition/wiki/` in `build:pages`. Change the `--base` there if the repository is renamed or the game moves.

## Conventions

- Rules live in `src/core/` and stay free of DOM and Three.js imports.
- In code, a placed explosive is always `bomb` and a participant is always `player`. Player-facing English says "charge" and "operator".
- New content goes in a pack, not in the engine. If a pack needs something the API lacks, add a hook to `module-api.ts`.
- Player-facing text is written in Chinese in code and translated in `src/locales/en.ts` or the pack's `translations`.
- Record every third-party asset and its licence in `public/assets/CREDITS.md`.

## Release

The game is a static site. `npm run build` output can be hosted anywhere that serves files over HTTP. Let browsers revalidate files under `mods/` so installed packs update.

GitHub Pages: every push to `main` runs `.github/workflows/deploy-pages.yml`, which builds the game and the wiki with `npm run build:pages` and publishes `.pages-build/` through the official Pages actions. In the repository settings, Pages > Source must be "GitHub Actions". To redeploy without a new commit, run the workflow by hand from the Actions tab. The game uses relative URLs (`base: "./"`), so it works under any path. The wiki does not, see [Wiki](#wiki).
