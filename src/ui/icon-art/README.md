# Painted core icons

Raster art for the two glyphs the core owns: `bomb.webp` (the charge, in the equipment wheel and
manual) and `coin.webp` (everywhere the coin glyph is drawn). 256 x 256, transparent background.

Every skill, item, perk and mutation keeps its painted icon in its own module folder as
`icon.webp` and names it in its config:

```js
icon: "cloak", // line glyph for small tinted slots
art: new URL("./icon.webp", import.meta.url).href,
```

A module without `art` shows its line glyph. Record the source of each image in
`public/assets/CREDITS.md`.
