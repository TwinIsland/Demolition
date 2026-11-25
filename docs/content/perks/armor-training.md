# Conditioning

<table class="infobox">
<caption>Conditioning</caption>
<tr><th>Type</th><td>Perk</td></tr>
<tr><th>ID</th><td><code>armor-training</code></td></tr>
<tr><th>Tier</th><td>Silver</td></tr>
<tr><th>Weight within tier</th><td>1</td></tr>
<tr><th>Tag</th><td>Health</td></tr>
<tr><th><code>stats.health</code></th><td>25</td></tr>
</table>

**Conditioning** is a perk in Demolition Front. In the game it is described as:

> Gain 25 max HP and recover 25 HP.

## Behaviour

- Adds `health` max HP and heals the same amount. No stack limit.

## Source

`src/modules/perks/armor-training/` (`config.js` holds the numbers, `index.js` the behaviour).

See also: [content reference](../README.md), [perk mods](../../modding/perks.md).
