# Cataclysm

<table class="infobox">
<caption>Cataclysm</caption>
<tr><th>Type</th><td>Perk</td></tr>
<tr><th>ID</th><td><code>apocalypse</code></td></tr>
<tr><th>Tier</th><td>Diamond</td></tr>
<tr><th>Weight within tier</th><td>1</td></tr>
<tr><th>Tag</th><td>Active perk</td></tr>
<tr><th>Requires</th><td>a map with <code>randomizeTerrain</code></td></tr>
<tr><th><code>stats.delay</code></th><td>3</td></tr>
</table>

**Cataclysm** is a perk in Demolition Front. In the game it is described as:

> Activate once to start a three-second arena-wide countdown. Surviving cover changes position and keeps its remaining durability.

## Behaviour

- Active perk: stored until you trigger it, then consumed. Only one copy can be held.
- After `delay` seconds, all surviving cover moves to new tiles and keeps its damage. Spawn zones, walls, occupied tiles and tiles holding items or charges are protected.
- Only offered on maps that implement `randomizeTerrain`. Cannot be triggered while another reset is pending.
- Bots trigger it below 45% HP or with an enemy charge within 2.5 tiles.

## Source

`src/modules/perks/apocalypse/` (`config.js` holds the numbers, `index.js` the behaviour).

See also: [content reference](../README.md), [perk mods](../../modding/perks.md).
