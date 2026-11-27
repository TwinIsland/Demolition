/**
 * Models for the Rainforest map's scanned plants and rocks.
 *
 * Reads Poly Haven glTF downloads (CC0), cuts each variant out as its own file, simplifies it to
 * a game budget and names its material `df:<key>`, so the material library supplies the shared
 * textures written by scripts/make-jungle-flora.py. The models carry geometry only.
 *
 *   npm i --no-save @gltf-transform/core @gltf-transform/functions meshoptimizer
 *   node scripts/make-jungle-flora.mjs <folder with one sub-folder per Poly Haven asset>
 */
import { NodeIO } from "@gltf-transform/core";
import { dedup, prune, simplify, weld } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import { mkdirSync } from "node:fs";

const source = process.argv[2];
const OUT = "public/assets/scenery";
/** [asset, node in the download, output name, palette key, triangle budget] */
const JOBS = [
  ["fern_02", "fern_02_b", "fern-a", "fern", 1300],
  ["fern_02", "fern_02_c", "fern-b", "fern", 1200],
  ["fern_02", "fern_02_a", "fern-c", "fern", 600],
  ["calathea_orbifolia_01", "calathea_orbifolia_01_a", "calathea-a", "calathea", 1000],
  ["calathea_orbifolia_01", "calathea_orbifolia_01_b", "calathea-b", "calathea", 800],
  ["anthurium_botany_01", "anthurium_botany_01_a", "anthurium-a", "anthurium", 1300],
  ["anthurium_botany_01", "anthurium_botany_01_b", "anthurium-b", "anthurium", 1300],
  ["shrub_03", "shrub_03_a", "shrub-a", "shrub", 800],
  ["shrub_03", "shrub_03_b", "shrub-b", "shrub", 700],
  ["rock_moss_set_01", "rock_moss_set_01_rock01", "rock-a", "scan-rock", 900],
  ["rock_moss_set_01", "rock_moss_set_01_rock02", "rock-b", "scan-rock", 900],
  ["rock_moss_set_01", "rock_moss_set_01_rock04", "rock-c", "scan-rock", 900],
  ["rock_moss_set_01", "rock_moss_set_01_rock06", "rock-d", "scan-rock", 900],
];

/**
 * Destructible obstacles made of several scans of one asset. Each part: node in the download,
 * triangle budget, scale, turn about the vertical in radians, and x, y, z.
 * [asset, output under assets/obstacles, palette key, parts]
 */
const GROUPS = [
  [
    "fern_02",
    "fern",
    "fern",
    [
      ["fern_02_b", 1300, 2.6, 0, 0, 0, 0],
      ["fern_02_c", 1200, 2.3, 2.1, 0.35, 0, 0.3],
      ["fern_02_a", 600, 2.6, 4.0, -0.4, 0, -0.35],
    ],
  ],
  [
    "anthurium_botany_01",
    "banana",
    "anthurium",
    [
      ["anthurium_botany_01_a", 1300, 5.2, 0, 0, 0, 0],
      ["anthurium_botany_01_b", 1300, 3.6, 2.4, 0.5, 0, 0.45],
    ],
  ],
  [
    "rock_moss_set_01",
    "boulder",
    "scan-rock",
    [
      ["rock_moss_set_01_rock04", 900, 1, 0, 0, 0.45, 0],
      ["rock_moss_set_01_rock03", 500, 0.55, 1.3, 0.95, 0.15, 0.7],
    ],
  ],
];

await MeshoptSimplifier.ready;
mkdirSync(OUT, { recursive: true });
const io = new NodeIO();
for (const [asset, nodeName, name, key, budget] of JOBS) {
  const doc = await io.read(`${source}/${asset}/${asset}.gltf`);
  const root = doc.getRoot();
  for (const node of root.listNodes()) {
    if (node.getName() === nodeName) node.setTranslation([0, 0, 0]);
    else node.dispose();
  }
  for (const material of root.listMaterials()) {
    material
      .setName(`df:${key}`)
      .setBaseColorTexture(null)
      .setNormalTexture(null)
      .setMetallicRoughnessTexture(null)
      .setOcclusionTexture(null);
  }
  for (const texture of root.listTextures()) texture.dispose();
  await doc.transform(prune({ keepAttributes: true }), dedup(), weld());
  const count = () =>
    root
      .listMeshes()
      .flatMap((mesh) => mesh.listPrimitives())
      .reduce((sum, primitive) => sum + primitive.getIndices().getCount() / 3, 0);
  const before = count();
  if (before > budget)
    await doc.transform(
      simplify({ simplifier: MeshoptSimplifier, ratio: budget / before, error: 0.05, lockBorder: false }),
    );
  await doc.transform(prune({ keepAttributes: true }));
  await io.write(`${OUT}/${name}.glb`, doc);
  console.log(name, before, "->", count());
}

for (const [asset, name, key, parts] of GROUPS) {
  const doc = await io.read(`${source}/${asset}/${asset}.gltf`);
  const root = doc.getRoot();
  const wanted = new Map(parts.map((part) => [part[0], part]));
  for (const node of root.listNodes()) {
    const part = wanted.get(node.getName());
    if (!part) {
      node.dispose();
      continue;
    }
    const [, , scale, turn, x, y, z] = part;
    node
      .setTranslation([x, y, z])
      .setRotation([0, Math.sin(turn / 2), 0, Math.cos(turn / 2)])
      .setScale([scale, scale, scale]);
  }
  for (const material of root.listMaterials())
    material
      .setName(`df:${key}`)
      .setBaseColorTexture(null)
      .setNormalTexture(null)
      .setMetallicRoughnessTexture(null)
      .setOcclusionTexture(null);
  for (const texture of root.listTextures()) texture.dispose();
  await doc.transform(prune({ keepAttributes: true }), weld());
  // Each part has its own mesh, so each is simplified to its own budget.
  for (const node of root.listNodes()) {
    const budget = wanted.get(node.getName())[1];
    const triangles = node
      .getMesh()
      .listPrimitives()
      .reduce((sum, primitive) => sum + primitive.getIndices().getCount() / 3, 0);
    if (triangles <= budget) continue;
    const others = root.listNodes().filter((other) => other !== node);
    const meshes = others.map((other) => other.getMesh());
    // `simplify` works on the whole document, so the other parts step aside for a moment.
    others.forEach((other) => other.setMesh(null));
    await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: budget / triangles, error: 0.05 }));
    others.forEach((other, index) => other.setMesh(meshes[index]));
  }
  await io.write(`public/assets/obstacles/${name}.glb`, doc);
  console.log("obstacle", name);
}
