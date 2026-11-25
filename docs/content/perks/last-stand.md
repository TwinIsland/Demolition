# Last Stand

<table class="infobox">
<caption>Last Stand</caption>
<tr><th>Type</th><td>Perk</td></tr>
<tr><th>ID</th><td><code>last-stand</code></td></tr>
<tr><th>Tier</th><td>Gold</td></tr>
<tr><th>Weight within tier</th><td>1</td></tr>
<tr><th>Tag</th><td>Comeback</td></tr>
<tr><th><code>stats.threshold</code></th><td>0.35</td></tr>
<tr><th><code>stats.speed</code></th><td>1.12</td></tr>
<tr><th><code>stats.power</code></th><td>1.25</td></tr>
</table>

**Last Stand** is a perk in Demolition Front. In the game it is described as:

> Below 35% HP you move 12% faster and your charges hit 25% harder. Does not stack.

## Behaviour

- While at or below `threshold` × max HP: movement speed × `speed`, and charges planted in that state carry × `power` blast power.
- Power is fixed when the charge is planted. Only one copy can be held.

## Source

`src/modules/perks/last-stand/` (`config.js` holds the numbers, `index.js` the behaviour).

See also: [content reference](../README.md), [perk mods](../../modding/perks.md).
