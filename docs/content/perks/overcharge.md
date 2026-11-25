# Overcharge

<table class="infobox">
<caption>Overcharge</caption>
<tr><th>Type</th><td>Perk</td></tr>
<tr><th>ID</th><td><code>overcharge</code></td></tr>
<tr><th>Tier</th><td>Gold</td></tr>
<tr><th>Weight within tier</th><td>1</td></tr>
<tr><th>Tag</th><td>Skill upgrade</td></tr>
<tr><th>Requires skill</th><td><code>surge</code></td></tr>
<tr><th><code>stats.bonus</code></th><td>1</td></tr>
</table>

**Overcharge** is a perk in Demolition Front. In the game it is described as:

> Add one more tile to Blast Surge and immediately refresh its cooldown.

## Behaviour

- Adds `bonus` tile(s) of range per stack to charges placed during Blast Surge, and resets its cooldown when picked.
- Requires the Blast Surge skill. No stack limit.

## Source

`src/modules/perks/overcharge/` (`config.js` holds the numbers, `index.js` the behaviour).

See also: [content reference](../README.md), [perk mods](../../modding/perks.md).
