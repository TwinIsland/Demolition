# Fast-Twitch Fibers

<table class="infobox">
<caption>Fast-Twitch Fibers</caption>
<tr><th>Type</th><td>Mutation</td></tr>
<tr><th>ID</th><td><code>fast-twitch</code></td></tr>
<tr><th><code>stats.step</code></th><td>0.22</td></tr>
<tr><th><code>stats.cap</code></th><td>3.3</td></tr>
</table>

**Fast-Twitch Fibers** is a mutation in Demolition Front. In the game it is described as:

> +0.22 tiles/s movement speed.

## Behaviour

- Adds `step` tiles/s of movement speed per copy, up to `cap`. No longer granted once speed reaches `cap`.

## Source

`src/modules/mutations/fast-twitch/` (`config.js` holds the numbers, `index.js` the behaviour).

See also: [content reference](../README.md), [mutation mods](../../modding/other-packs.md).
