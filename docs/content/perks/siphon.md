# Siphon Charge

<table class="infobox">
<caption>Siphon Charge</caption>
<tr><th>Type</th><td>Perk</td></tr>
<tr><th>ID</th><td><code>siphon</code></td></tr>
<tr><th>Tier</th><td>Diamond</td></tr>
<tr><th>Weight within tier</th><td>1</td></tr>
<tr><th>Tag</th><td>Recovery</td></tr>
<tr><th><code>stats.fraction</code></th><td>0.15</td></tr>
<tr><th><code>stats.maxStacks</code></th><td>2</td></tr>
</table>

**Siphon Charge** is a perk in Demolition Front. In the game it is described as:

> Recover HP equal to 15% of the damage you deal to opponents per stack, up to 2 stacks.

## Behaviour

- Heals `fraction` × stacks of the damage you deal to operators, rounded.
- Offered until you hold `maxStacks`.

## Source

`src/modules/perks/siphon/` (`config.js` holds the numbers, `index.js` the behaviour).

See also: [content reference](../README.md), [perk mods](../../modding/perks.md).
