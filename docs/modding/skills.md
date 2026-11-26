# Skill mods

A skill is `defineSkill(config, behavior)` in `skills/<id>/`. Types: `SkillConfig` and `SkillBehavior` in `src/core/module-api.ts`. Built-in examples: [content reference](../content/README.md#skills).

Skills are bought before the match with starting coins (115 in standard modes, 4 slots) and kept for the whole match. See [Med Injector](../content/skills/medic.md) for a heal over time built on `onTick` and `moduleData`.

```js
// skills/dash/config.js
export default {
  id: "dash", name: "冲刺", description: "3 秒内移动速度提高 40%。",
  translations: { en: { name: "Dash", description: "Move 40% faster for 3 seconds." } },
  icon: "speed", key: "G", code: "KeyG",
  price: 30, cooldown: 16, duration: 3, stats: { factor: 1.4 },
};

// skills/dash/index.js
import { defineSkill } from "../../sdk.js";
import config from "./config.js";

export default defineSkill(config, {
  activate(player, state, duration) { player.moduleData.dashUntil = state.time + duration; },
  activeUntil: player => player.moduleData.dashUntil ?? 0,
  modifiers: {
    moveSpeed: (value, player, stacks, time) =>
      (player.moduleData.dashUntil ?? 0) > time ? value * config.stats.factor : value,
  },
});
```

## Config

| Field | Meaning |
| --- | --- |
| `price` | Cost in credits |
| `cooldown`, `duration` | Seconds. Both can be changed by modifiers |
| `key` | Label shown on the skill bar |
| `code` | Default key as a `KeyboardEvent.code`. Must be unique among skills. Players can rebind it |
| `passive` | No activation. The skill only contributes hooks |
| `endSound` | Optional audio URL played when the effect runs out or is cut short. Needs `activeUntil` |
| `endSoundRange` | Tiles from which other operators hear `endSound`. Omitted, only the owner hears it |

A skill that is not `passive` must define `activate`.

## Behaviour

| Member | Meaning |
| --- | --- |
| `activate(player, state, duration)` | Runs when the cast is accepted. `duration` already includes `duration:<id>` modifiers |
| `canActivate(player, time)` | Return `false` to refuse the cast without starting the cooldown |
| `activeUntil(player)` | Simulation time at which the HUD indicator ends |
| `isActive(player, time)` | For toggles: whether the skill is currently on |
| `aiCastPriority(player, time, contacts)` | Return a positive number when a bot should cast. `contacts` are opponents the bot has seen |

Keep per-player state in `player.moduleData`, a map of numbers. Prefix your keys with the pack ID.

Two built-in states are read by the renderer and the bots, and a skill may set them directly: `player.cloakUntil` (invisible to opponents, bots and zombies until that time) and `player.veilUntil` (HUD timer of [Blind Fuse](../content/skills/veil.md)).

## Hooks shared with perks

A skill gets these while owned. Perks get the same ones, with `stacks` set to the number of copies.

| Hook | When |
| --- | --- |
| `onTick(player, state, dt, stacks)` | Every simulation step, 60 times a second |
| `onCoverDestroyed(player, stacks)` | The owner destroys cover |
| `onDamageDealt(player, damage, stacks)` | The owner damages another operator |
| `onBombContact(kick)` | The owner has pushed into a charge long enough. Call `kick()` to send it sliding |
| `modifiers` | Functions `(value, player, stacks, time) => value` keyed by stat |

Stats that accept modifiers:

| Stat | Base |
| --- | --- |
| `moveSpeed` | The operator's speed |
| `placementRadius` | 2 tiles |
| `bombRange` | The operator's range, read when a charge is placed |
| `bombFuse` | 2.65 s, read when a charge is placed |
| `bombPower` | The operator's attack power, read when a charge is placed |
| `blastPierce` | 0. Pieces of destructible cover a blast passes through |
| `bombConcealed` | 0, read when a charge is placed. Above 0 the charge hides its blast path from everyone but its owner |
| `coinGain` | The coins of one reward |
| `blastDuration` | 0.42 s |
| `cooldown` | The skill's cooldown, read when it is cast |
| `duration:<skill id>` | That skill's duration. `duration:shield` is the shield time |
| `crateScore` | 25 |
| `staminaRegen` | 18 per second |

Modifiers apply in order: skills by purchase order, then perks by first pick.
