# Fleet Footed

<table class="infobox">
<caption>Fleet Footed</caption>
<tr><th>Type</th><td>Perk</td></tr>
<tr><th>ID</th><td><code>light-feet</code></td></tr>
<tr><th>Tier</th><td>Silver</td></tr>
<tr><th>Weight within tier</th><td>1</td></tr>
<tr><th>Tag</th><td>Mobility</td></tr>
<tr><th><code>stats.amount</code></th><td>1.12</td></tr>
<tr><th><code>stats.cap</code></th><td>3.3</td></tr>
</table>

**Fleet Footed** is a perk in Demolition Front. In the game it is described as:

> Increase movement speed by 12% for the rest of the match.

## Behaviour

- Multiplies movement speed by `amount` (base 2.3 tiles/s).
- Offered while speed is below `cap` tiles/s, and never raises it past that.

## Source

`src/modules/perks/light-feet/` (`config.js` holds the numbers, `index.js` the behaviour).

See also: [content reference](../README.md), [perk mods](../../modding/perks.md).
