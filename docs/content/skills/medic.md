# Med Injector

<table class="infobox">
<caption>Med Injector</caption>
<tr><th>Type</th><td>Skill</td></tr>
<tr><th>ID</th><td><code>medic</code></td></tr>
<tr><th>Price</th><td>30</td></tr>
<tr><th>Cooldown</th><td>24 s</td></tr>
<tr><th>Duration</th><td>3 s</td></tr>
<tr><th>Default key</th><td>F</td></tr>
<tr><th><code>stats.heal</code></th><td>30</td></tr>
</table>

**Med Injector** is a skill in Demolition Front. In the game it is described as:

> Recover 30 HP over 3 seconds. Taking damage stops the treatment.

## Behaviour

- Heals `heal` HP spread evenly over the duration, capped at max HP. Cannot be cast at full health.
- Losing any health stops the treatment. The rest of the heal is lost.
- Bots cast it when at least 30 HP is missing.

## Source

`src/modules/skills/medic/` (`config.js` holds the numbers, `index.js` the behaviour).

See also: [content reference](../README.md), [skill mods](../../modding/skills.md).
