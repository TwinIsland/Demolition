# Slide Kick

<table class="infobox">
<caption>Slide Kick</caption>
<tr><th>Type</th><td>Skill</td></tr>
<tr><th>ID</th><td><code>kick</code></td></tr>
<tr><th>Price</th><td>35</td></tr>
<tr><th>Cooldown</th><td>–</td></tr>
<tr><th>Duration</th><td>–</td></tr>
<tr><th>Default key</th><td>passive</td></tr>
</table>

**Slide Kick** is a skill in Demolition Front. In the game it is described as:

> Push against a charge to kick it. Its fuse pauses while sliding; impact detonates it.

## Behaviour

- Passive. Stand outside a charge, line up with it (within 0.3 tile sideways, 0.8 tile ahead) and keep pushing into it for 0.12 s.
- The charge slides one tile every 0.12 s with its fuse paused, and detonates when it hits a wall, cover, another charge, an operator, a zombie or a blast.
- A charge you are still standing on is never kicked. Any other operator walking into a sliding charge sets it off.
- Constants: `KICK` and `SLIDE_STEP` in `src/core/geometry.ts`.

## Source

`src/modules/skills/kick/` (`config.js` holds the numbers, `index.js` the behaviour).

See also: [content reference](../README.md), [skill mods](../../modding/skills.md).
