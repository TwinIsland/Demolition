// Shrinks a Meshy export into a game-ready prop: ~6k triangles, WebP textures, upright, base at y = 0.
// usage: node optimize.mjs IN.glb OUT.glb [rx,ry,rz degrees] [displaySize] [triangles]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, textureCompress, prune, dedup, flatten, joinPrimitives, transformMesh, getBounds, unpartition } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
const [src, out, rot = '0,0,0', displaySize = '', target = '6000'] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(src);
const root = doc.getRoot();
await doc.transform(flatten(), weld());
let tris = 0;
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += p.getIndices().getCount() / 3;
await MeshoptSimplifier.ready;
await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, +target / tris), error: 0.02 }));
// Bake rotation, then centre on x/z and rest on the ground.
const [rx, ry, rz] = rot.split(',').map((d) => (+d * Math.PI) / 180);
const mat = (m) => { for (const mesh of root.listMeshes()) transformMesh(mesh, m); };
const c = Math.cos, s = Math.sin;
const Rx = [1,0,0,0, 0,c(rx),s(rx),0, 0,-s(rx),c(rx),0, 0,0,0,1];
const Ry = [c(ry),0,-s(ry),0, 0,1,0,0, s(ry),0,c(ry),0, 0,0,0,1];
const Rz = [c(rz),s(rz),0,0, -s(rz),c(rz),0,0, 0,0,1,0, 0,0,0,1];
for (const node of root.listNodes()) node.setTranslation([0,0,0]).setRotation([0,0,0,1]).setScale([1,1,1]);
mat(Rz); mat(Rx); mat(Ry);
const b = getBounds(root.listScenes()[0]);
mat([1,0,0,0, 0,1,0,0, 0,0,1,0, -(b.min[0]+b.max[0])/2, -b.min[1], -(b.min[2]+b.max[2])/2, 1]);
for (const t of root.listTextures()) {
  const isColor = root.listMaterials().some((m) => m.getBaseColorTexture() === t);
  const size = isColor ? 1024 : 512;
  const img = sharp(t.getImage()).resize(size, size);
  t.setImage(await img.webp({ quality: isColor ? 82 : 78 }).toBuffer()).setMimeType('image/webp');
}
doc.createExtension(ALL_EXTENSIONS.find((e) => e.EXTENSION_NAME === 'EXT_texture_webp')).setRequired(true);
if (displaySize) root.listScenes()[0].setExtras({ displaySize: +displaySize });
await doc.transform(prune(), dedup());
let after = 0;
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) after += p.getIndices().getCount() / 3;
await io.write(out, doc);
const nb = getBounds(root.listScenes()[0]);
console.log(out.split('/').pop(), tris, '->', after, 'size', nb.max.map((v, i) => +(v - nb.min[i]).toFixed(2)));
