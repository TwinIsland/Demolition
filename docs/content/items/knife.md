# Knife

<table class="infobox">
<caption>Knife</caption>
<tr><th>Type</th><td>Item</td></tr>
<tr><th>ID</th><td><code>knife</code></td></tr>
<tr><th>Drop pool</th><td>supply</td></tr>
<tr><th>Base drop weight</th><td>0</td></tr>
<tr><th>Shop price</th><td>not sold</td></tr>
<tr><th>Permanent</th><td>yes</td></tr>
<tr><th>Melee</th><td>reach 0.94, damage 24, cooldown 0.36, inputBuffer 0.1, coverDamage 1</td></tr>
</table>

**Knife** is an item in Demolition Front. In the game it is described as:

> Always available. Two strikes take down a zombie or break a piece of destructible cover.

## Behaviour

- Permanent: always on the gear wheel, never consumed, never dropped (`weight` 0).
- Hits the nearest operator or zombie within `reach` tiles, inside a cone of about 61° around the aim direction, with a clear line of sight.
- Zombies have 48 HP, so two strikes kill one. A hit operator is immune for 0.3 s.
- Destructible cover in front of the target is struck first: `coverDamage` per swing against a durability of 2. Cover broken this way scores and rolls loot like a blast.

## Source

`src/modules/items/knife/` (`config.js` holds the numbers, `index.js` the behaviour).

See also: [content reference](../README.md), [item mods](../../modding/items.md).
