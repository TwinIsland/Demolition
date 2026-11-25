# Piercing Charge

<table class="infobox">
<caption>Piercing Charge</caption>
<tr><th>Type</th><td>Perk</td></tr>
<tr><th>ID</th><td><code>piercing-charge</code></td></tr>
<tr><th>Tier</th><td>Diamond</td></tr>
<tr><th>Weight within tier</th><td>1</td></tr>
<tr><th>Tag</th><td>Breach</td></tr>
<tr><th><code>stats.pierce</code></th><td>1</td></tr>
</table>

**Piercing Charge** is a perk in Demolition Front. In the game it is described as:

> Your blasts break through one destructible obstacle and keep going. Permanent walls still stop them. Does not stack.

## Behaviour

- Each arm of your blasts destroys the first piece of destructible cover and continues to the next obstacle. Permanent walls still stop it.
- Only one copy can be held.

## Source

`src/modules/perks/piercing-charge/` (`config.js` holds the numbers, `index.js` the behaviour).

See also: [content reference](../README.md), [perk mods](../../modding/perks.md).
