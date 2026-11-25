# Field Recovery

<table class="infobox">
<caption>Field Recovery</caption>
<tr><th>Type</th><td>Perk</td></tr>
<tr><th>ID</th><td><code>repair</code></td></tr>
<tr><th>Tier</th><td>Gold</td></tr>
<tr><th>Weight within tier</th><td>1</td></tr>
<tr><th>Tag</th><td>Survival</td></tr>
<tr><th><code>stats.heal</code></th><td>40</td></tr>
<tr><th><code>stats.duration</code></th><td>4.5</td></tr>
</table>

**Field Recovery** is a perk in Demolition Front. In the game it is described as:

> Recover 40 HP and activate or refresh your tactical shield.

## Behaviour

- Heals `heal` HP and sets the shield timer to at least `duration` seconds.
- Offered only while you are hurt or your shield has less than `duration` seconds left.

## Source

`src/modules/perks/repair/` (`config.js` holds the numbers, `index.js` the behaviour).

See also: [content reference](../README.md), [perk mods](../../modding/perks.md).
