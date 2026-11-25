# Blast Expansion

<table class="infobox">
<caption>Blast Expansion</caption>
<tr><th>Type</th><td>Mutation</td></tr>
<tr><th>ID</th><td><code>blast-reach</code></td></tr>
<tr><th><code>stats.range</code></th><td>1</td></tr>
<tr><th><code>stats.cap</code></th><td>5</td></tr>
</table>

**Blast Expansion** is a mutation in Demolition Front. In the game it is described as:

> +1 tile of charge blast range.

## Behaviour

- Adds `range` tile(s) of blast range per copy, up to `cap`. No longer granted once range reaches `cap`.

## Source

`src/modules/mutations/blast-reach/` (`config.js` holds the numbers, `index.js` the behaviour).

See also: [content reference](../README.md), [mutation mods](../../modding/other-packs.md).
