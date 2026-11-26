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

> Right-click to build a wooden crate ahead instantly for 25 coins.

## Behaviour

- Right-click: pays coins and stands a crate on the tile ahead at once, independently of equipped gear.
- Always costs 25 coins (`BUILD.cost`). Never dropped, carried, equipped or sold in the supply shop.
- No standing-crate limit. The tile must be free of operators, zombies, items, charges and fire.
- A built crate behaves like cover with durability 2, but gives no score. Breaking it rolls loot with the same chance as any other cover. Another operator who destroys it gets 2 coins. It shows the builder's emblem.

## Source

`src/modules/items/crate/` (`config.js` holds the numbers, `index.js` the behaviour).

See also: [content reference](../README.md), [item mods](../../modding/items.md).
