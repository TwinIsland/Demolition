// Turns models of the KayKit packs (CC0, Kay Lousberg) into the village's game-ready GLBs.
// Every output is one or more pack models, placed, scaled and joined; the atlas texture is left
// out and the material renamed to a palette key, so that all of them share one material in game.
//
// usage: node tools/model-import/kaykit.mjs MEDIEVAL_PACK_DIR HALLOWEEN_PACK_DIR [only-id ...]
//   (the two directories are checkouts of github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0
//    and .../KayKit-Halloween-Bits-1.0; needs @gltf-transform/core and /functions, see README.md)
import { readdirSync, statSync } from "node:fs";
import { join as joinPath, resolve } from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { dedup, flatten, join, mergeDocuments, prune, unpartition } from "@gltf-transform/functions";

const [medieval, halloween, ...only] = process.argv.slice(2);
const io = new NodeIO();

/** Every .gltf under the two packs, by file name without the extension. */
const sources = new Map();
const scan = (dir, pack) => {
  for (const name of readdirSync(dir)) {
    const path = joinPath(dir, name);
    if (statSync(path).isDirectory()) scan(path, pack);
    else if (name.endsWith(".gltf") && !path.includes("fbx")) sources.set(name.slice(0, -5), { path, pack });
  }
};
scan(resolve(medieval), "medieval");
scan(resolve(halloween), "halloween");

const T = 2.4;
/** One pack model in an output: [name, scale | [sx, sy, sz], x, y, z, turn in degrees]. */
const one = (name, scale = 1, x = 0, y = 0, z = 0, turn = 0) => ({ name, scale, x, y, z, turn });

const SCENERY = "public/assets/scenery/village-";
const OBSTACLE = "public/assets/obstacles/";
/** Output path to its parts. Buildings are authored around the middle of their footprint, door to +Z. */
const OUTPUTS = {
  // Buildings, scaled from the pack's strategy-map size to cells of 2.4 m.
  [SCENERY + "house-a"]: [one("building_home_A_red", 5.2)],
  [SCENERY + "house-b"]: [one("building_home_B_red", 4.1)],
  [SCENERY + "house-c"]: [one("building_home_A_green", 5.2)],
  [SCENERY + "tavern"]: [one("building_tavern_red", 4.9)],
  [SCENERY + "market"]: [one("building_market_yellow", 3.6)],
  [SCENERY + "archery"]: [one("building_archeryrange_blue", 2.85)],
  [SCENERY + "barracks"]: [one("building_barracks_blue", 3.0)],
  [SCENERY + "church"]: [one("building_church_blue", 4.5)],
  [SCENERY + "blacksmith"]: [one("building_blacksmith_green", 3.6)],
  [SCENERY + "windmill"]: [one("building_windmill_yellow", 4.0)],
  [SCENERY + "tower"]: [one("building_tower_A_blue", 2.3)],
  [SCENERY + "well"]: [one("building_well_blue", 2.9)],
  [SCENERY + "castle"]: [one("building_castle_blue", 1)],
  [SCENERY + "crypt"]: [one("crypt", 0.72)],
  // The boundary: one stretch of wall per cell, 2.4 m long.
  [SCENERY + "wall"]: [one("wall_straight", [1.2, 2.0, 1.7])],
  [SCENERY + "gate"]: [one("wall_straight_gate", [1.2, 2.0, 1.7])],
  [SCENERY + "block"]: [one("wall_straight", [1.2, 2.0, 2.95])],
  // The pack draws a fence along one edge of its tile, one unit off the origin: the offset brings
  // it back onto the middle of the cell it blocks, and the width makes it read as a wall from above.
  [SCENERY + "low-wall"]: [one("fence_stone_straight", [6.5, 3.3, 2.09], 0, 0.1, -6.5, 90)],
  // Landmarks of one cell.
  [SCENERY + "lantern"]: [one("fence_pillar", [1, 0.58, 1]), one("lantern_standing", 0.95, 0, 1.27, 0)],
  [SCENERY + "notice"]: [one("shrine", 0.95)],
  [SCENERY + "arch"]: [one("arch", 1.3)],
  [SCENERY + "grave-a"]: [one("gravestone", 1)],
  [SCENERY + "grave-b"]: [one("grave_A", 0.85)],
  [SCENERY + "grave-c"]: [one("gravemarker_A", 1.25, -0.35, 0, 0.1, 8), one("gravemarker_B", 1.1, 0.5, 0, -0.15, -12)],
  [SCENERY + "tree-a"]: [one("tree_single_A", 3.6, 0, 0.3, 0)],
  [SCENERY + "tree-b"]: [one("tree_single_B", 3.3, 0, 0.28, 0)],
  [SCENERY + "rock-a"]: [one("rock_single_C", 5.5)],
  [SCENERY + "rock-b"]: [one("rock_single_E", 5.5)],
  [SCENERY + "flag"]: [one("flag_blue", 9)],
  // The countryside, at the pack's own size: the scenery code scales these.
  [SCENERY + "hills"]: [one("hills_A_trees")],
  [SCENERY + "hills-b"]: [one("hills_B_trees")],
  [SCENERY + "mountain"]: [one("mountain_A_grass_trees")],
  [SCENERY + "mountain-b"]: [one("mountain_B_grass")],
  [SCENERY + "forest"]: [one("trees_B_large")],
  [SCENERY + "forest-b"]: [one("trees_A_large")],
  [SCENERY + "field"]: [one("building_grain")],
  // Destructible obstacles: the game fits each to its tile, so only proportions matter here.
  [OBSTACLE + "village-crate"]: [one("crate_A_big")],
  [OBSTACLE + "barrels"]: [one("barrel", 1, -0.11, 0, -0.07), one("barrel", 1, 0.11, 0, -0.05, 40), one("barrel", 1, 0.01, 0, 0.13, 80)],
  [OBSTACLE + "crate-stack"]: [
    one("crate_B_big", 1, -0.1, 0, -0.04, 6),
    one("crate_A_big", 1, 0.13, 0, 0.02, -9),
    one("crate_A_small", 1, -0.08, 0.21, -0.03, 24),
    one("crate_long_A", 0.9, 0.02, 0, 0.21, 4),
  ],
  [OBSTACLE + "sacks"]: [
    one("pallet", 1.25),
    one("sack", 1.5, -0.08, 0.08, -0.07, 10),
    one("sack", 1.5, 0.09, 0.08, -0.06, -15),
    one("sack", 1.5, 0, 0.08, 0.1, 85),
    one("sack", 1.5, 0.01, 0.165, -0.04, 50),
  ],
  [OBSTACLE + "wheelbarrow"]: [one("wheelbarrow", 1, 0, 0, 0, 25), one("bucket_water", 1, 0.2, 0, 0.14)],
  [OBSTACLE + "lumber"]: [
    one("resource_lumber", 1, 0, 0, -0.19, 3),
    one("resource_lumber", 1, 0.03, 0, 0.19, -4),
    one("resource_lumber", 0.9, -0.02, 0.2, 0, 86),
    one("bucket_empty", 1.2, 0.42, 0, 0.36),
  ],
  [OBSTACLE + "training-rack"]: [one("weaponrack", 1.3, -0.08, 0, 0), one("target", 1.2, 0.17, 0, 0.02, -20), one("bucket_arrows", 1, 0.04, 0, 0.17)],
  [OBSTACLE + "wood-fence"]: [one("fence_wood_straight", 1, 0, 0.05, 0, 90)],
};

const PALETTE = { medieval: "df:kaykit-medieval", halloween: "df:kaykit-halloween" };

for (const [out, parts] of Object.entries(OUTPUTS)) {
  if (only.length && !only.some((id) => out.endsWith(id))) continue;
  let target;
  for (const part of parts) {
    const source = sources.get(part.name);
    if (!source) throw new Error(`No model named ${part.name}`);
    const doc = await io.read(source.path);
    const root = doc.getRoot(),
      scene = root.listScenes()[0];
    const [sx, sy, sz] = Array.isArray(part.scale) ? part.scale : [part.scale, part.scale, part.scale];
    const half = (part.turn * Math.PI) / 360;
    const holder = doc
      .createNode("part")
      .setTranslation([part.x, part.y, part.z])
      .setRotation([0, Math.sin(half), 0, Math.cos(half)])
      .setScale([sx, sy, sz]);
    for (const node of scene.listChildren()) holder.addChild(node);
    scene.addChild(holder);
    for (const material of root.listMaterials())
      material.setName(PALETTE[source.pack]).setBaseColorTexture(null).setRoughnessFactor(1);
    for (const texture of root.listTextures()) texture.dispose();
    if (!target) target = doc;
    else {
      const map = mergeDocuments(target, doc);
      const main = target.getRoot().listScenes()[0];
      for (const merged of target.getRoot().listScenes())
        if (merged !== main) {
          for (const node of merged.listChildren()) main.addChild(node);
          merged.dispose();
        }
      void map;
    }
  }
  await target.transform(unpartition(), dedup(), flatten(), join(), prune({ keepAttributes: true }));
  await io.write(`${out}.glb`, target);
  console.log(out);
}
