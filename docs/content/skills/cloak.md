# Optical Camo

<table class="infobox">
<caption>Optical Camo</caption>
<tr><th>Type</th><td>Skill</td></tr>
<tr><th>ID</th><td><code>cloak</code></td></tr>
<tr><th>Price</th><td>35</td></tr>
<tr><th>Cooldown</th><td>30 s</td></tr>
<tr><th>Duration</th><td>6 s</td></tr>
<tr><th>Default key</th><td>Q</td></tr>
</table>

**Optical Camo** is a skill in Demolition Front. In the game it is described as:

> Turn invisible for 6 seconds. Opponents, bots and zombies lose sight of you; Threat Scan still reveals you.

## Behaviour

- Invisible for `duration` seconds: other operators do not see your body, health bar, shield or radar blip. Your footsteps are still heard.
- Bots lose sight of you and cannot aim charges, grenades, knives or a Missile Strike at you; zombies stop tracking and attacking you. Blasts and the fire zone still hurt.
- [Threat Scan](scan.md) reveals cloaked operators to whoever is scanning, bots included.
- You see your own arm and body ripple while it lasts. Bots cast it when hurt with an opponent in sight, or with one within 5 tiles.

## Source

`src/modules/skills/cloak/` (`config.js` holds the numbers, `index.js` the behaviour).

See also: [content reference](../README.md), [skill mods](../../modding/skills.md).
