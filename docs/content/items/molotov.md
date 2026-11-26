# Molotov

<table class="infobox">
<caption>Molotov</caption>
<tr><th>Type</th><td>Item</td></tr>
<tr><th>ID</th><td><code>molotov</code></td></tr>
<tr><th>Drop pool</th><td>supply</td></tr>
<tr><th>Base drop weight</th><td>2.6</td></tr>
<tr><th>Shop price</th><td>30 coins</td></tr>
<tr><th>Permanent</th><td>no</td></tr>
<tr><th>Throwable</th><td>reach 4, flight 0.6, trajectory lob</td></tr>
</table>

**Molotov** is an item in Demolition Front. In the game it is described as:

> Lob over cover. It shatters on landing and sets the floor around it alight for 4.5 seconds, burning anyone who stands in the flames, you included.

## Behaviour

- Lobbed to any clear tile within `reach` tiles, landing after `flight` seconds. It shatters on landing; there is no fuse.
- Lights every open tile within `fire.radius` tiles that the flames can reach without crossing a wall or cover, for `fire.duration` seconds.
- Anyone standing in the fire, the thrower included, loses `fire.damage` HP every 0.5 s. A shield blocks it. Zombies that touch it die. It does not open cover or set off charges.
- Drop weight: `weight ÷ (1 + Molotovs held)`.
- Bots treat burning tiles as blast cells, and throw one at a visible target more than 2.7 tiles away when they hold no grenade.

## Source

`src/modules/items/molotov/` (`config.js` holds the numbers, `index.js` the behaviour).

See also: [content reference](../README.md), [item mods](../../modding/items.md).
