# Item mods

An item is `defineItem(config, behavior)` in `items/<id>/`. Types: `ItemConfig` and `ItemBehavior` in `src/core/module-api.ts`. Built-in examples: [content reference](../content/README.md#items).

```js
// items/stim/config.js
export default {
  id: "stim", name: "兴奋剂", description: "立即恢复 50 点体力。",
  translations: { en: { name: "Stim", description: "Restore 50 stamina at once." } },
  icon: "stamina", color: "#9fe0c0", pool: "supply", weight: 2,
  stats: { stamina: 50 },
};

// items/stim/index.js
import { defineItem } from "../../sdk.js";
import config from "./config.js";

export default defineItem(config, {
  dropWeight: (p, base) => base / (1 + (p.inventory.stim ?? 0)),
  onUse(p) {
    if (p.stamina >= p.maxStamina) return false; // not consumed
    p.stamina = Math.min(p.maxStamina, p.stamina + config.stats.stamina);
    return true;
  },
});
```

## Kinds of item

The fields you set decide how the item works.

| Kind | Set | Behaviour |
| --- | --- | --- |
| Self-use gear | `onUse` | Goes to the gear wheel. Used with the fire button, one unit spent when `onUse` returns `true` |
| Throwable | `throwable` and `onLand` | Thrown to a target tile. `onLand` runs after `flight` seconds. Must not define `onUse` |
| Melee | `melee` | Swings on the fire button. Usually combined with `permanent` |
| Instant pickup | none of the above | `onPickup` runs when walked over. Nothing is stored |

## Config

| Field | Meaning |
| --- | --- |
| `color` | Accent colour in the UI |
| `pool` | `"supply"` or `"elite"`. Only `supply` items drop today |
| `weight` | Base drop weight, 0 or more. See [Probabilities](../probabilities.md#which-item) |
| `model` | GLB shown on the ground and in hand |
| `permanent` | Always available, never consumed, never dropped |
| `quickEquipCode` | Default key to equip it, as a `KeyboardEvent.code` such as `"KeyX"` |
| `price` | Coin price in the in-match supply shop. Omit it to keep the item out of the shop |
| `pickupScore` | Score for picking it up (default 10) |
| `throwable` | `{ reach, flight, blastRange?, fuse?, powerScale?, trajectory? }`. `reach` in tiles, `flight` in seconds. `fuse` and `powerScale` are passed to `explode`. `trajectory: "lob"` makes player throws arc over walls and cover. Equipped throwables automatically preview their landing tile; press use to throw. A direct throw uses the charge placement radius and needs a clear path |
| `melee` | `{ reach, damage, cooldown, inputBuffer?, hitSound?, coverDamage?, coverSounds? }`. `coverSounds` maps `wood`, `metal`, `soft` to audio URLs |
| `shieldSounds` | `{ broken, expired }` audio for items that set `player.shield` |

The ID `bomb` is reserved.

## Behaviour hooks

| Hook | When | Notes |
| --- | --- | --- |
| `onUse(player, context)` | The holder fires with the item equipped | Return `true` to spend one. `context.build()` starts a crate build on the tile ahead. `context.stat(key, base)` applies skill and perk modifiers, for example `context.stat("duration:shield", 4.5)` |
| `onLand(impact)` | A thrown item lands | `impact.explode(range, { fuse, powerScale })` makes a cross blast: `fuse` seconds after landing (default 0), at `powerScale` × the thrower's power (default 1). `impact.burn({ radius, duration, damage })` lights the floor around the landing tile: open tiles within `radius` that the flames can reach without crossing a wall or cover burn for `duration` seconds and cost anyone standing in them `damage` HP every 0.5 s. `impact.projectile` has the tile and owner |
| `onPickup(player)` | Any item is picked up | Runs after the inventory count is raised |
| `dropWeight(player, base)` | Loot is rolled | Return this operator's demand for the item. Lower it as they hold more, so drops adapt |
| `aiPickupValue(player)` | Bots plan a route | How much a bot wants it (default 19) |
