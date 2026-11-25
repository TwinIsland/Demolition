# Dimensional Collapse

<table class="infobox">
<caption>Dimensional Collapse</caption>
<tr><th>Type</th><td>Perk</td></tr>
<tr><th>ID</th><td><code>dimension-collapse</code></td></tr>
<tr><th>Tier</th><td>Mythic</td></tr>
<tr><th>Weight within tier</th><td>1</td></tr>
<tr><th>Tag</th><td>Active perk</td></tr>
<tr><th><code>stats.warningSeconds</code></th><td>3</td></tr>
<tr><th><code>stats.duration</code></th><td>10</td></tr>
</table>

**Dimensional Collapse** is a perk in Demolition Front. In the game it is described as:

> After a 3-second arena countdown, lock every operator in overhead view for 10 seconds. Each operator then returns to their previous view.

## Behaviour

- Active perk: stored until you trigger it, then consumed. Only one copy can be held.
- After a `warningSeconds` countdown every operator is locked in overhead view for `duration` seconds, then returns to their previous view.
- Bots trigger it when an opponent is within 6 tiles.

## Source

`src/modules/perks/dimension-collapse/` (`config.js` holds the numbers, `index.js` the behaviour).

See also: [content reference](../README.md), [perk mods](../../modding/perks.md).
