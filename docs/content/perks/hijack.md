# Hijack

<table class="infobox">
<caption>Hijack</caption>
<tr><th>Type</th><td>Perk</td></tr>
<tr><th>ID</th><td><code>hijack</code></td></tr>
<tr><th>Tier</th><td>Diamond</td></tr>
<tr><th>Weight within tier</th><td>1</td></tr>
<tr><th>Tag</th><td>Active perk</td></tr>
</table>

**Hijack** is a perk in Demolition Front. In the game it is described as:

> Activate once. Every enemy charge whose blast path joins up with the path of one of your own charges becomes yours, and so does every charge chained on through them. They score for you, cost you only own-charge damage, and no longer spare whoever planted them. Hijacked charges do not use your charge slots.

## Behaviour

- Active perk: stored until you trigger it, then consumed. Only one copy can be held.
- Two charges are linked when their blast paths share at least one tile. Starting from your own live charges, every other operator's charge or landed grenade linked to them changes owner at once, and so does anything linked on through those. Paths are the ones drawn on the floor: walls and cover cut them short. Fuses keep running; nothing is moved or defused.
- From then on the charge is yours in every respect: kills, score and cover rewards go to you, its blast costs you only own-charge damage and hits its former owner in full, your [Remote Detonator](../skills/detonator.md) sets it off, and a [Blind Fuse](../skills/veil.md) trail is shown to you instead of them.
- Hijacked charges do not count against your charge capacity. The button stays grey while no foreign charge is linked to one of yours, so the perk cannot be wasted. Where you stand does not matter.
- Bots trigger it with two or more linked foreign charges, or with one when below 50% HP.

## Source

`src/modules/perks/hijack/` (`config.js` holds the numbers, `index.js` the behaviour).

See also: [content reference](../README.md), [perk mods](../../modding/perks.md).
