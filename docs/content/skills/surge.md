# Blast Surge

<table class="infobox">
<caption>Blast Surge</caption>
<tr><th>Type</th><td>Skill</td></tr>
<tr><th>ID</th><td><code>surge</code></td></tr>
<tr><th>Price</th><td>30</td></tr>
<tr><th>Cooldown</th><td>18 s</td></tr>
<tr><th>Duration</th><td>5 s</td></tr>
<tr><th>Default key</th><td>Q</td></tr>
<tr><th><code>stats.rangeBonus</code></th><td>2</td></tr>
</table>

**Blast Surge** is a skill in Demolition Front. In the game it is described as:

> Charges placed over the next 5 seconds gain two tiles of blast range.

## Behaviour

- For `duration` seconds, charges you place get `rangeBonus` extra tiles of range. Range is fixed when the charge is placed.
- Upgraded by the [Overcharge](../perks/overcharge.md) perk.

## Source

`src/modules/skills/surge/` (`config.js` holds the numbers, `index.js` the behaviour).

See also: [content reference](../README.md), [skill mods](../../modding/skills.md).
