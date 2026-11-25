# Rapid Circuit

<table class="infobox">
<caption>Rapid Circuit</caption>
<tr><th>Type</th><td>Perk</td></tr>
<tr><th>ID</th><td><code>capacitor</code></td></tr>
<tr><th>Tier</th><td>Diamond</td></tr>
<tr><th>Weight within tier</th><td>1</td></tr>
<tr><th>Tag</th><td>Cooldown</td></tr>
<tr><th>Requires</th><td>any active skill</td></tr>
<tr><th><code>stats.factor</code></th><td>0.8</td></tr>
<tr><th><code>stats.maxStacks</code></th><td>2</td></tr>
</table>

**Rapid Circuit** is a perk in Demolition Front. In the game it is described as:

> Reduce active skill cooldowns by 20%. Each stack applies to the remaining cooldown, up to 2 stacks.

## Behaviour

- Multiplies the cooldown of every active skill by `factor` per stack (two stacks: ×0.64). Applied when the skill is cast.
- Requires at least one active skill. Offered until you hold `maxStacks`.

## Source

`src/modules/perks/capacitor/` (`config.js` holds the numbers, `index.js` the behaviour).

See also: [content reference](../README.md), [perk mods](../../modding/perks.md).
