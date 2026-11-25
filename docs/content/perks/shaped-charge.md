# Shaped Charge

<table class="infobox">
<caption>Shaped Charge</caption>
<tr><th>Type</th><td>Perk</td></tr>
<tr><th>ID</th><td><code>shaped-charge</code></td></tr>
<tr><th>Tier</th><td>Gold</td></tr>
<tr><th>Weight within tier</th><td>1</td></tr>
<tr><th>Tag</th><td>Damage</td></tr>
<tr><th><code>stats.amount</code></th><td>15</td></tr>
<tr><th><code>stats.maxStacks</code></th><td>3</td></tr>
</table>

**Shaped Charge** is a perk in Demolition Front. In the game it is described as:

> Increase attack power by 15 per stack, up to 3 stacks. Your charge bundle and blast warning change with power.

## Behaviour

- Adds `amount` attack power per stack (base 70). Charges switch visuals at 85 and 130 power.
- Offered until you hold `maxStacks`.

## Source

`src/modules/perks/shaped-charge/` (`config.js` holds the numbers, `index.js` the behaviour).

See also: [content reference](../README.md), [perk mods](../../modding/perks.md).
