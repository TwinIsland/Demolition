# Extended Reach

<table class="infobox">
<caption>Extended Reach</caption>
<tr><th>Type</th><td>Perk</td></tr>
<tr><th>ID</th><td><code>long-reach</code></td></tr>
<tr><th>Tier</th><td>Gold</td></tr>
<tr><th>Weight within tier</th><td>1</td></tr>
<tr><th>Tag</th><td>Deployment</td></tr>
<tr><th><code>stats.reach</code></th><td>1</td></tr>
<tr><th><code>stats.maxStacks</code></th><td>2</td></tr>
</table>

**Extended Reach** is a perk in Demolition Front. In the game it is described as:

> Increase charge placement reach by one tile per stack, up to 2 stacks.

## Behaviour

- Adds `reach` tile(s) to the charge placement radius per stack (base 2).
- Offered until you hold `maxStacks`.

## Source

`src/modules/perks/long-reach/` (`config.js` holds the numbers, `index.js` the behaviour).

See also: [content reference](../README.md), [perk mods](../../modding/perks.md).
