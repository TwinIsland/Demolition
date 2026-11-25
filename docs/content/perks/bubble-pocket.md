# Ammo Pouch

<table class="infobox">
<caption>Ammo Pouch</caption>
<tr><th>Type</th><td>Perk</td></tr>
<tr><th>ID</th><td><code>bubble-pocket</code></td></tr>
<tr><th>Tier</th><td>Silver</td></tr>
<tr><th>Weight within tier</th><td>1</td></tr>
<tr><th>Tag</th><td>Firepower</td></tr>
<tr><th><code>stats.amount</code></th><td>1</td></tr>
<tr><th><code>stats.cap</code></th><td>5</td></tr>
</table>

**Ammo Pouch** is a perk in Demolition Front. In the game it is described as:

> Carry one additional active charge.

## Behaviour

- Adds `amount` to the number of charges you can have placed at once (base 2).
- Offered until capacity reaches `cap`.

## Source

`src/modules/perks/bubble-pocket/` (`config.js` holds the numbers, `index.js` the behaviour).

See also: [content reference](../README.md), [perk mods](../../modding/perks.md).
