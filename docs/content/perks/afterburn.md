# Afterburn

<table class="infobox">
<caption>Afterburn</caption>
<tr><th>Type</th><td>Perk</td></tr>
<tr><th>ID</th><td><code>afterburn</code></td></tr>
<tr><th>Tier</th><td>Gold</td></tr>
<tr><th>Weight within tier</th><td>1</td></tr>
<tr><th>Tag</th><td>Area denial</td></tr>
<tr><th><code>stats.seconds</code></th><td>0.2</td></tr>
<tr><th><code>stats.maxStacks</code></th><td>3</td></tr>
</table>

**Afterburn** is a perk in Demolition Front. In the game it is described as:

> Each stack extends charge fire by 0.2 seconds, up to 3 stacks.

## Behaviour

- Adds `seconds` to the fire duration of your charges per stack (base 0.42 s).
- Offered until you hold `maxStacks`.

## Source

`src/modules/perks/afterburn/` (`config.js` holds the numbers, `index.js` the behaviour).

See also: [content reference](../README.md), [perk mods](../../modding/perks.md).
