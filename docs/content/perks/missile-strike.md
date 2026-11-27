# Missile Strike

<table class="infobox">
<caption>Missile Strike</caption>
<tr><th>Type</th><td>Perk</td></tr>
<tr><th>ID</th><td><code>missile-strike</code></td></tr>
<tr><th>Tier</th><td>Diamond</td></tr>
<tr><th>Weight within tier</th><td>1</td></tr>
<tr><th>Tag</th><td>Active perk</td></tr>
<tr><th>Targeting</th><td>pick a tile on the targeting tablet</td></tr>
<tr><th><code>stats.delay</code></th><td>2.5</td></tr>
<tr><th><code>stats.radius</code></th><td>2.6</td></tr>
<tr><th><code>stats.power</code></th><td>140</td></tr>
</table>

**Missile Strike** is a perk in Demolition Front. In the game it is described as:

> Activate once to open the targeting tablet and pick a tile. A missile lands there 2.5 seconds later: a wide blast that ignores walls and hits hard. Only you see the landing zone at first; everyone else gets 1.5 seconds of warning.

## Behaviour

- Active perk: stored until you trigger it, then consumed. Only one copy can be held.
- Triggering opens the targeting tablet, a 2D map of the arena. Click a tile (or steer with the movement keys and press Enter) to fire; right-click or Esc cancels and keeps the perk. The match keeps running while the tablet is open.
- After `delay` seconds the missile lands. Every open or cover tile within `radius` tiles burns for 0.9 s at `power` blast power, falling off with distance from the centre. Walls give no shelter, cover inside is destroyed, and charges inside are set off.
- The caller takes full damage from it. A shield blocks it like any blast. Everyone hears the warning at launch, but only the caller sees the marker on the ground and on the radar from the start; everyone else sees it for the last 1.5 s.
- Bots fire at the opponent they have seen with the most others nearby, never within `radius` + 1.5 tiles of themselves, and move out of a marked area.

## Source

`src/modules/perks/missile-strike/` (`config.js` holds the numbers, `index.js` the behaviour).

See also: [content reference](../README.md), [perk mods](../../modding/perks.md).
