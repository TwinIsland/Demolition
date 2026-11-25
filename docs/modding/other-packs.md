# Other packs

## Mutations

`defineMutation(config, { apply(player), eligible?(player) })` in `mutations/<id>/`. The config uses only the [common fields](README.md#common-config-fields).

`apply` runs each time an operator gains a copy. Return `false` from the optional `eligible` to stop granting the mutation, for example at a stat cap. The engine handles the kill check, the roll, the copy count, the notice and the sound. Every eligible mutation is equally likely, see [Probabilities](../probabilities.md#zombie-drops).

```js
import { defineMutation } from "../../sdk.js";

export default defineMutation(
  { id: "thick-skin", name: "厚皮", icon: "shield", description: "生命上限 +10。",
    translations: { en: { name: "Thick Skin", description: "+10 maximum HP." } } },
  { apply(p) { p.maxHp += 10; } },
);
```

## Skins

`defineSkin` in `skins/<id>/`, with a Minecraft-format skin PNG.

```js
import { defineSkin } from "../../sdk.js";

export default defineSkin({
  id: "ranger", name: "游骑兵",
  translations: { en: { name: "Ranger" } },
  texture: new URL("./skin.png", import.meta.url).href,
  model: "auto", // or "default" (wide arms), "slim"
  emblem: new URL("./emblem.svg", import.meta.url).href,
});
```

`emblem` is an optional square image with a transparent background (SVG, PNG or WebP), stencilled on crates the character builds. The ID `custom` is reserved for skins imported in the game.

## Charge finishes

`defineFinish` in `bomb-finishes/<id>/`.

| Field | Meaning |
| --- | --- |
| `colors` | Three hex colours, one per power tier of the charge: below 85 attack, 85 and up, 130 and up |
| `texture`, `roughnessMap` | Optional wrap textures |
| `roughness`, `metalness` | Optional material values, 0 to 1 |
| `capColor` | Optional end-cap colour |

Copy `bomb-finishes/olive/` as a starting point.
