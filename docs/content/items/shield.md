# Tactical Shield

<table class="infobox">
<caption>Tactical Shield</caption>
<tr><th>Type</th><td>Item</td></tr>
<tr><th>ID</th><td><code>shield</code></td></tr>
<tr><th>Drop pool</th><td>supply</td></tr>
<tr><th>Base drop weight</th><td>3.4</td></tr>
<tr><th>Shop price</th><td>40 coins</td></tr>
<tr><th>Permanent</th><td>no</td></tr>
<tr><th>Default quick key</th><td>X</td></tr>
<tr><th><code>stats.duration</code></th><td>4.5</td></tr>
</table>

**Tactical Shield** is an item in Demolition Front. In the game it is described as:

> Blocks melee and zombie attacks for up to 4.5 seconds. The first blast it absorbs shatters the shield.

## Behaviour

- Use: starts a shield lasting `duration` seconds (stat `duration:shield`). Cannot be used while a shield is up, and is not consumed in that case.
- Blocks every melee and zombie hit while active. The first blast breaks it, and that whole explosion deals no damage to the holder.
- Drop weight: `weight × (1 + 1.8 × missingHp) ÷ (1 + shieldActive + shields held)`.
- Bots value a pickup at 25, or 14 while shielded.

## Source

`src/modules/items/shield/` (`config.js` holds the numbers, `index.js` the behaviour).

See also: [content reference](../README.md), [item mods](../../modding/items.md).
