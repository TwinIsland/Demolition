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

> Right-click to build a wooden crate on the aimed tile instantly. Costs no coins: you carry a stock set by your level, refilled on every level-up, and destroying another operator's crate adds one to it. Reaches as far as a planted charge.

## Behaviour

- Right-click: takes one crate from your stock and stands it on the aimed tile at once (same reach as a planted charge), independently of equipped gear.
- Costs no coins. The stock is 3 crates at level 1 and one more per level, up to 8 (`BUILD` and `crateStock` in `core/economy.ts`); every level-up refills it. Never dropped, equipped or sold in the supply shop.
- No standing-crate limit beyond the stock. The tile must be free of operators, zombies, items, charges and fire.
- A built crate behaves like cover with durability 2, but gives no score. Breaking it rolls loot with the same chance as any other cover. Another operator who destroys it gets 2 coins and one crate for their own stock, which can exceed their level's number up to the cap of 8. It shows the builder's emblem.

## Source

`src/modules/items/crate/` (`config.js` holds the numbers, `index.js` the behaviour).

See also: [content reference](../README.md), [item mods](../../modding/items.md).
