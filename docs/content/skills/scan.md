# Threat Scan

<table class="infobox">
<caption>Threat Scan</caption>
<tr><th>Type</th><td>Skill</td></tr>
<tr><th>ID</th><td><code>scan</code></td></tr>
<tr><th>Price</th><td>25</td></tr>
<tr><th>Cooldown</th><td>25 s</td></tr>
<tr><th>Duration</th><td>7 s</td></tr>
<tr><th>Default key</th><td>C</td></tr>
</table>

**Threat Scan** is a skill in Demolition Front. In the game it is described as:

> See operators and zombies through cover as night-vision silhouettes for 7 seconds.

## Behaviour

- Shows operators and zombies through cover for `duration` seconds.
- Bots cast it when they have no opponent in sight.

## Source

`src/modules/skills/scan/` (`config.js` holds the numbers, `index.js` the behaviour).

See also: [content reference](../README.md), [skill mods](../../modding/skills.md).
