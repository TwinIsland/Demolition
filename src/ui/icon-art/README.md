# Painted icon art

Raster icons that replace the line glyphs of `src/ui/icons.ts`. One file per id, 256 x 256,
transparent background, `<id>.webp` (or `.png`):

| Folder | Ids | Shown in |
| --- | --- | --- |
| `equipment/` | `bomb` and item ids | equipment wheel, supply shop, crate chip, manual |
| `skills/` | skill ids | skill bar, skill shop, manual |
| `perks/` | perk ids | perk cards, HUD buff icons, strike panel, manual |
| `mutations/` | mutation ids | gene notice, HUD buff icons, manual |
| `glyphs/` | glyph names, e.g. `coin` | everywhere that glyph is drawn |

- Most slots are 24 to 50 px: keep one bold shape per icon.
- Picked up at build time; anything without a file keeps its line glyph.
- Record the source of each image in `public/assets/CREDITS.md`.
