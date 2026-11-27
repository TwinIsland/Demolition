# Hijack

<table class="infobox">
<caption>Hijack</caption>
<tr><th>Type</th><td>Perk</td></tr>
<tr><th>ID</th><td><code>hijack</code></td></tr>
<tr><th>Tier</th><td>Diamond</td></tr>
<tr><th>Weight within tier</th><td>1</td></tr>
<tr><th>Tag</th><td>Active perk</td></tr>
<tr><th><code>stats.radius</code></th><td>3</td></tr>
</table>

**Hijack** is a perk in Demolition Front. In the game it is described as:

> Activate once. Every charge and live grenade within 3 tiles of you becomes yours: it scores for you, costs you only own-charge damage, and no longer spares the operator who planted it. Hijacked charges do not use your charge slots.

## Behaviour

- Active perk: stored until you trigger it, then consumed. Only one copy can be held.
- Every planted charge and landed grenade of another operator within `radius` tiles of you changes owner at once. Fuses keep running; nothing is moved or defused.
- From then on the charge is yours in every respect: kills, score and cover rewards go to you, its blast costs you only own-charge damage and hits its former owner in full, your [Remote Detonator](../skills/detonator.md) sets it off, and a [Blind Fuse](../skills/veil.md) trail is shown to you instead of them.
- Hijacked charges do not count against your charge capacity. The button stays grey while no foreign charge is in reach, so the perk cannot be wasted.
- Bots trigger it with two or more foreign charges in reach, or below 50% HP when standing in the path of one.

## Source

`src/modules/perks/hijack/` (`config.js` holds the numbers, `index.js` the behaviour).

See also: [content reference](../README.md), [perk mods](../../modding/perks.md).
