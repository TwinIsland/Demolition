# Remote Detonator

<table class="infobox">
<caption>Remote Detonator</caption>
<tr><th>Type</th><td>Skill</td></tr>
<tr><th>ID</th><td><code>detonator</code></td></tr>
<tr><th>Price</th><td>30</td></tr>
<tr><th>Cooldown</th><td>10 s</td></tr>
<tr><th>Duration</th><td>–</td></tr>
<tr><th>Default key</th><td>E</td></tr>
<tr><th><code>stats.delay</code></th><td>0.35</td></tr>
</table>

**Remote Detonator** is a skill in Demolition Front. In the game it is described as:

> Set off all of your planted charges after a 0.35 second delay.

## Behaviour

- Every charge you have planted goes off `delay` seconds after the cast, unless its own fuse is shorter.
- Thrown explosives are not affected. Cannot be cast with no planted charge.
- Bots do not buy it.

## Source

`src/modules/skills/detonator/` (`config.js` holds the numbers, `index.js` the behaviour).

See also: [content reference](../README.md), [skill mods](../../modding/skills.md).
