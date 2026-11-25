# Short Fuse

<table class="infobox">
<caption>Short Fuse</caption>
<tr><th>Type</th><td>Perk</td></tr>
<tr><th>ID</th><td><code>short-fuse</code></td></tr>
<tr><th>Tier</th><td>Gold</td></tr>
<tr><th>Weight within tier</th><td>1</td></tr>
<tr><th>Tag</th><td>Tempo</td></tr>
<tr><th><code>stats.rate</code></th><td>0.15</td></tr>
<tr><th><code>stats.maxStacks</code></th><td>2</td></tr>
</table>

**Short Fuse** is a perk in Demolition Front. In the game it is described as:

> Your charges go off 15% sooner per stack, up to 2 stacks.

## Behaviour

- Multiplies the fuse of charges you plant by `1 − rate × stacks` (base 2.65 s; two stacks: 1.86 s).
- Offered until you hold `maxStacks`.

## Source

`src/modules/perks/short-fuse/` (`config.js` holds the numbers, `index.js` the behaviour).

See also: [content reference](../README.md), [perk mods](../../modding/perks.md).
