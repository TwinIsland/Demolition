# Salvage

<table class="infobox">
<caption>Salvage</caption>
<tr><th>Type</th><td>Perk</td></tr>
<tr><th>ID</th><td><code>salvage</code></td></tr>
<tr><th>Tier</th><td>Silver</td></tr>
<tr><th>Weight within tier</th><td>1</td></tr>
<tr><th>Tag</th><td>Recovery</td></tr>
<tr><th><code>stats.heal</code></th><td>3</td></tr>
</table>

**Salvage** is a perk in Demolition Front. In the game it is described as:

> Recover 3 HP for each piece of cover you destroy. Stacks.

## Behaviour

- Heals `heal` HP per stack for each piece of cover you destroy. No stack limit.

## Source

`src/modules/perks/salvage/` (`config.js` holds the numbers, `index.js` the behaviour).

See also: [content reference](../README.md), [perk mods](../../modding/perks.md).
