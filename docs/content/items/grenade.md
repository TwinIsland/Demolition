# Frag Grenade

<table class="infobox">
<caption>Frag Grenade</caption>
<tr><th>Type</th><td>Item</td></tr>
<tr><th>ID</th><td><code>grenade</code></td></tr>
<tr><th>Drop pool</th><td>supply</td></tr>
<tr><th>Base drop weight</th><td>2.4</td></tr>
<tr><th>Shop price</th><td>35 coins</td></tr>
<tr><th>Permanent</th><td>no</td></tr>
<tr><th>Throwable</th><td>reach 4, flight 0.6, blastRange 2, fuse 0.45, powerScale 0.75, trajectory lob</td></tr>
</table>

**Frag Grenade** is an item in Demolition Front. In the game it is described as:

> Lob over walls and cover. Lands on a clear tile within four tiles and explodes a moment later at 75% of your charge power.

## Behaviour

- Lobbed over walls and cover to any clear tile within `reach` tiles, landing after `flight` seconds. A direct (low) throw uses the charge placement radius and needs a clear path.
- After landing it lies live for `fuse` seconds, then explodes in a cross of `blastRange` tiles at `powerScale` × the thrower's attack power.
- The thrower takes normal blast damage from it, not the reduced damage of an own charge.
- Drop weight: `weight ÷ (1 + grenades held)`.

## Source

`src/modules/items/grenade/` (`config.js` holds the numbers, `index.js` the behaviour).

See also: [content reference](../README.md), [item mods](../../modding/items.md).
