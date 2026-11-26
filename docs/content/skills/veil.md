# Blind Fuse

<table class="infobox">
<caption>Blind Fuse</caption>
<tr><th>Type</th><td>Skill</td></tr>
<tr><th>ID</th><td><code>veil</code></td></tr>
<tr><th>Price</th><td>30</td></tr>
<tr><th>Cooldown</th><td>22 s</td></tr>
<tr><th>Duration</th><td>7 s</td></tr>
<tr><th>Default key</th><td>Z</td></tr>
</table>

**Blind Fuse** is a skill in Demolition Front. In the game it is described as:

> For 7 seconds your charges hide their blast path from everyone else. You see it as a violet dashed trail.

## Behaviour

- For `duration` seconds, charges you plant are concealed, and so are the charges you already have on the ground at the cast. A concealed charge stays concealed until it goes off.
- Other operators see the charge itself but no blast path. You see the path as a violet dashed outline instead of the usual warning stripes.
- Bots cannot read a concealed charge either: they assume a reach of 1 tile, so longer blasts catch them. The fire itself is visible to everyone as usual.
- Bots cast it when an opponent they have seen is within 6 tiles.

## Source

`src/modules/skills/veil/` (`config.js` holds the numbers, `index.js` the behaviour).

See also: [content reference](../README.md), [skill mods](../../modding/skills.md).
