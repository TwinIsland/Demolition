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
