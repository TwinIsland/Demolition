# Bandage

<table class="infobox">
<caption>Bandage</caption>
<tr><th>Type</th><td>Item</td></tr>
<tr><th>ID</th><td><code>bandage</code></td></tr>
<tr><th>Drop pool</th><td>supply</td></tr>
<tr><th>Base drop weight</th><td>3</td></tr>
<tr><th>Shop price</th><td>25 coins</td></tr>
<tr><th>Permanent</th><td>no</td></tr>
<tr><th><code>stats.heal</code></th><td>30</td></tr>
</table>

**Bandage** is an item in Demolition Front. In the game it is described as:

> Restore 30 HP. Kept in your inventory at full health.

## Behaviour

- Use: heals `heal` HP, capped at max HP. At full health nothing happens and the bandage is kept.
- Drop weight: `weight × (0.65 + 2.6 × missingHp) ÷ (1 + bandages held)`, where `missingHp` is the missing fraction of max HP.
- Bots value a pickup at `16 + 22 × missingHp`.

## Source

`src/modules/items/bandage/` (`config.js` holds the numbers, `index.js` the behaviour).

See also: [content reference](../README.md), [item mods](../../modding/items.md).
