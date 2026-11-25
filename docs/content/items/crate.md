# Field Crate

<table class="infobox">
<caption>Field Crate</caption>
<tr><th>Type</th><td>Item</td></tr>
<tr><th>ID</th><td><code>crate</code></td></tr>
<tr><th>Drop pool</th><td>supply</td></tr>
<tr><th>Base drop weight</th><td>0</td></tr>
<tr><th>Shop price</th><td>20 coins</td></tr>
<tr><th>Permanent</th><td>no</td></tr>
</table>

**Field Crate** is an item in Demolition Front. In the game it is described as:

> Builds a wooden crate on the tile ahead after a 0.6 second windup. Up to 3 of your crates can stand at once. Sold in the supply shop only.

## Behaviour

- Use: starts a 0.6 s build on the tile ahead (`BUILD.windup`). The crate is spent when the build starts and returned if damage or stepping away interrupts it.
- Never drops. Bought in the supply shop, where each repeat purchase costs 25% of the base price more, and at most 3 can be carried.
- At most 3 of your crates stand at once (`BUILD.limit`). The tile must be free of operators, zombies, items, charges and fire.
- A built crate behaves like cover with durability 2, but gives no score and no loot. Another operator who destroys it gets 2 coins. It shows the builder's emblem.

## Source

`src/modules/items/crate/` (`config.js` holds the numbers, `index.js` the behaviour).

See also: [content reference](../README.md), [item mods](../../modding/items.md).
