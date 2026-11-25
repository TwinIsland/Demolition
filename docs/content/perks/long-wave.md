# High Explosive

<table class="infobox">
<caption>High Explosive</caption>
<tr><th>Type</th><td>Perk</td></tr>
<tr><th>ID</th><td><code>long-wave</code></td></tr>
<tr><th>Tier</th><td>Silver</td></tr>
<tr><th>Weight within tier</th><td>1</td></tr>
<tr><th>Tag</th><td>Blast range</td></tr>
<tr><th><code>stats.amount</code></th><td>1</td></tr>
<tr><th><code>stats.cap</code></th><td>5</td></tr>
</table>

**High Explosive** is a perk in Demolition Front. In the game it is described as:

> Increase the blast range of all charges by one tile for the rest of the match.

## Behaviour

- Adds `amount` tile(s) of blast range to every charge (base 2).
- Offered while range is below `cap`.

## Source

`src/modules/perks/long-wave/` (`config.js` holds the numbers, `index.js` the behaviour).

See also: [content reference](../README.md), [perk mods](../../modding/perks.md).
