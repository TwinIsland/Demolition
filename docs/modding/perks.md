# Perk mods

A perk is `definePerk(config, behavior)` in `perks/<id>/`. Types: `PerkConfig` and `PerkBehavior` in `src/core/module-api.ts`. Built-in examples: [content reference](../content/README.md#perks).

A level-up offers three perks and the player keeps one. Picking the same perk again adds a stack.

```js
// perks/scavenger/config.js
export default {
  id: "scavenger", name: "拾荒者", description: "摧毁掩体的积分提高 20%，最多 2 层。",
  translations: { en: { name: "Scavenger", tag: "Economy",
    description: "Cover gives 20% more score per stack, up to 2 stacks." } },
  icon: "target", color: "#e6c36a", tag: "经济", tier: "gold", weight: 1,
  stats: { bonus: 0.2, maxStacks: 2 },
};

// perks/scavenger/index.js
import { definePerk } from "../../sdk.js";
import config from "./config.js";

export default definePerk(config, {
  eligible: p => p.perks.filter(id => id === config.id).length < config.stats.maxStacks,
  modifiers: { crateScore: (value, p, stacks) => value * (1 + config.stats.bonus * stacks) },
});
```

## Config

| Field | Meaning |
| --- | --- |
| `tier` | `silver`, `gold`, `diamond` or `mythic`. Decides rarity and card colour |
| `weight` | Share inside the tier. 0 removes the perk from offers |
| `tag` | Short category label on the card |
| `color` | Accent colour |
| `requiresSkill` | Only offered to owners of this skill ID |
| `requiresActiveSkill` | Only offered to owners of at least one active skill |
| `requiresTerrainReset` | Only offered on maps with `randomizeTerrain` |
| `targeted` | Active perk that needs a tile: the player picks it on the targeting tablet first. `stats.radius` and `stats.delay` are shown there |

How tiers and weights turn into chances is in [Probabilities](../probabilities.md#perk-offers). Adding a perk to a tier dilutes the others in that tier and does not change the tier's own chance.

## Behaviour

| Member | Meaning |
| --- | --- |
| `onAcquire(player, context)` | Runs once per pick. Use it for one-time changes such as `player.maxHp += 25` |
| `eligible(player)` | Return `false` to keep the perk out of offers. Stack limits and stat caps go here |
| `modifiers` and the other hooks | Same as skills, see [Skill mods](skills.md#hooks-shared-with-perks). `stacks` is the number of copies owned, and each hook is called once with that total |
| `aiPriority(player)` | How much a bot wants it. Default 6 for gold, 4 otherwise |

Permanent stat changes in `onAcquire` are simplest. Use `modifiers` when the effect is conditional or should scale with stacks.

## Active perks

A perk with `use` is stored and triggered later by the player. It then appears in the active perk list.

| Member | Meaning |
| --- | --- |
| `use(player, context)` | Do the effect. Return `true` to consume one copy |
| `canUse(player, state)` | Greys out the button and blocks the action when `false` |
| `aiShouldUse(player, state)` | When a bot triggers it |
| `aiTarget(player, state, contacts)` | Targeted perks only: the tile a bot fires at, or `undefined` to hold. `contacts` are opponents the bot has seen, so a cloaked operator is never in it |

`context` offers arena-wide effects:

| Call | Effect |
| --- | --- |
| `context.stat(key, base)` | A stat with the player's modifiers applied |
| `context.requestTerrainReset(delay)` | Reshuffles cover after `delay` seconds. Returns `false` if the map does not support it or a reset is pending |
| `context.forceArenaView(duration, warningSeconds)` | Locks every operator in overhead view. Returns `false` while another forced view is running |
| `context.target` | The tile picked for a `targeted` perk |
| `context.callStrike(target, { delay, radius, power })` | Calls a missile onto `target`. After `delay` seconds every open or cover tile within `radius` burns at `power`; walls give no shelter. Returns `false` outside the arena |

See [Cataclysm](../content/perks/apocalypse.md), [Dimensional Collapse](../content/perks/dimension-collapse.md) and [Missile Strike](../content/perks/missile-strike.md).
