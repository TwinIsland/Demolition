# Endurance

<table class="infobox">
<caption>Endurance</caption>
<tr><th>Type</th><td>Perk</td></tr>
<tr><th>ID</th><td><code>endurance</code></td></tr>
<tr><th>Tier</th><td>Silver</td></tr>
<tr><th>Weight within tier</th><td>1</td></tr>
<tr><th>Tag</th><td>Mobility</td></tr>
<tr><th><code>stats.amount</code></th><td>25</td></tr>
<tr><th><code>stats.regenBonus</code></th><td>0.15</td></tr>
<tr><th><code>stats.maxStacks</code></th><td>3</td></tr>
</table>

**Endurance** is a perk in Demolition Front. In the game it is described as:

> Per stack: +25 max stamina, 15% faster stamina recovery, and 25 stamina restored at once. Up to 3 stacks.

## Behaviour

- Per stack: `amount` max stamina, `regenBonus` × 100% faster stamina recovery, and `amount` stamina restored at once.
- Offered until you hold `maxStacks`.

## Source

`src/modules/perks/endurance/` (`config.js` holds the numbers, `index.js` the behaviour).

See also: [content reference](../README.md), [perk mods](../../modding/perks.md).
