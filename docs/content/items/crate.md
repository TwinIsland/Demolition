# Field Crate

<table class="infobox">
<caption>Field Crate</caption>
<tr><th>Type</th><td>Item</td></tr>
<tr><th>ID</th><td><code>crate</code></td></tr>
<tr><th>Drop pool</th><td>supply</td></tr>
<tr><th>Base drop weight</th><td>0</td></tr>
<tr><th>Shop price</th><td>not sold</td></tr>
<tr><th>Permanent</th><td>no</td></tr>
</table>

**Field Crate** is an item in Demolition Front. In the game it is described as:

> Right-click to build a wooden crate ahead. Takes 0.6 seconds and costs coins.

## Behaviour

- Right-click: pays coins and starts a 0.6 s build on the tile ahead (`BUILD.windup`), independently of equipped gear. Damage, movement or an obstruction cancels it and refunds the reserved coins.
- Costs 20 coins initially, plus 5 for each crate completed this match (`crateCost`). Interrupted builds do not raise the price. Never dropped, carried, equipped or sold in the supply shop.
- No standing-crate limit. The tile must be free of operators, zombies, items, charges and fire.
- A built crate behaves like cover with durability 2, but gives no score and no loot. Another operator who destroys it gets 2 coins. It shows the builder's emblem.

## Source

`src/modules/items/crate/` (`config.js` holds the numbers, `index.js` the behaviour).

See also: [content reference](../README.md), [item mods](../../modding/items.md).
