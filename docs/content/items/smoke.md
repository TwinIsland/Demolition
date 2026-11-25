# Smoke Grenade

<table class="infobox">
<caption>Smoke Grenade</caption>
<tr><th>Type</th><td>Item</td></tr>
<tr><th>ID</th><td><code>smoke</code></td></tr>
<tr><th>Drop pool</th><td>supply</td></tr>
<tr><th>Base drop weight</th><td>2.8</td></tr>
<tr><th>Shop price</th><td>20 coins</td></tr>
<tr><th>Permanent</th><td>no</td></tr>
<tr><th>Throwable</th><td>reach 4, flight 0.55, trajectory lob</td></tr>
<tr><th><code>stats.duration</code></th><td>6</td></tr>
<tr><th><code>stats.radius</code></th><td>1.65</td></tr>
</table>

**Smoke Grenade** is an item in Demolition Front. In the game it is described as:

> Lob over cover to create a smoke screen that lasts 6 seconds.

## Behaviour

- Lobbed to any clear tile within `reach` tiles, landing after `flight` seconds.
- Creates a cloud of `radius` tiles for `duration` seconds. A sight line passing through the cloud is blocked for zombies and bots.
- Drop weight: `weight × (1 + 0.8 × missingHp) ÷ (1 + smokes held)`.

## Source

`src/modules/items/smoke/` (`config.js` holds the numbers, `index.js` the behaviour).

See also: [content reference](../README.md), [item mods](../../modding/items.md).
