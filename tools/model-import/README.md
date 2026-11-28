# Model import

`optimize.mjs` turns a raw image-to-3D export (tens of MB, millions of triangles, 4K textures)
into a game-ready prop: about 6k triangles, WebP textures (1024 colour, 512 others), no mesh
compression (the game ships no decoder), rotation baked in, centred on x/z with its base at y = 0.

```
npm i --no-save @gltf-transform/core @gltf-transform/functions @gltf-transform/extensions meshoptimizer sharp
node tools/model-import/optimize.mjs IN.glb OUT.glb [rx,ry,rz degrees] [displaySize] [triangles]
```

Item models used this way (2026-11-27): bandage (displaySize 0.72), crate, grenade, knife, molotov
(rotated 0,0,-31 to stand upright), shield. Items expect: upright along +Y, front towards +Z; a
knife has its handle at the bottom and is thin along Z.

## KayKit village models

`kaykit.mjs` builds every model of the Flatland village (`public/assets/scenery/village-*.glb` and
the village obstacles) from two CC0 packs by Kay Lousberg. Each output is a list of pack models with
a place, a turn and a scale; the script joins them, drops the pack's swatch texture and names the
material `df:kaykit-medieval` or `df:kaykit-halloween`, so that the game colours all of them from
one shared material (`public/assets/surfaces/kaykit-*_diff.webp`).

```
git clone --depth 1 https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0
git clone --depth 1 https://github.com/KayKit-Game-Assets/KayKit-Halloween-Bits-1.0
npm i --no-save @gltf-transform/core @gltf-transform/functions
node tools/model-import/kaykit.mjs KayKit-Medieval-Hexagon-Pack-1.0 KayKit-Halloween-Bits-1.0 [only-id ...]
```

To add a model: add a line to `OUTPUTS` in the script, run it, then list the id in `SCENERY`
(`src/render/cover-models.ts`) or add a `preset` in `src/core/obstacles.ts`.
