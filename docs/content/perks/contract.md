# Bounty Contract

<table class="infobox">
<caption>Bounty Contract</caption>
<tr><th>Type</th><td>Perk</td></tr>
<tr><th>ID</th><td><code>contract</code></td></tr>
<tr><th>Tier</th><td>Silver</td></tr>
<tr><th>Weight within tier</th><td>1</td></tr>
<tr><th>Tag</th><td>Economy</td></tr>
<tr><th><code>stats.bonus</code></th><td>0.4</td></tr>
<tr><th><code>stats.maxStacks</code></th><td>2</td></tr>
</table>

**Bounty Contract** is a perk in Demolition Front. In the game it is described as:

> Earn 40% more coins per stack, up to 2 stacks.

## Behaviour

- Multiplies every coin reward by `1 + bonus × stacks`.
- Offered until you hold `maxStacks`.

## Source

`src/modules/perks/contract/` (`config.js` holds the numbers, `index.js` the behaviour).

See also: [content reference](../README.md), [perk mods](../../modding/perks.md).
