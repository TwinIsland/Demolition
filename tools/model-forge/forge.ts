import type * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { obstacles } from "./obstacles";
import { items } from "./items";
import { ordnance } from "./ordnance";

const builders: Record<string, () => THREE.Group> = {
  ...Object.fromEntries(
    Object.entries(obstacles).map(([id, build]) => [`obstacles/${id}`, build]),
  ),
  ...Object.fromEntries(
    Object.entries(items).map(([id, build]) => [`items/${id}`, build]),
  ),
  ...Object.fromEntries(
    Object.entries(ordnance).map(([id, build]) => [`ordnance/${id}`, build]),
  ),
};
async function exportModel(id: string) {
  const model = builders[id]();
  const buffer = (await new GLTFExporter().parseAsync(model, {
    binary: true,
  })) as ArrayBuffer;
  return {
    buffer,
    stats: model.userData as { triangles: number; size: number[] },
  };
}
/** Used by scripted exports: returns every model as base64 with its statistics. */
async function exportAll() {
  const result: Record<
    string,
    { glb: string; triangles: number; size: number[] }
  > = {};
  for (const id of Object.keys(builders)) {
    const { buffer, stats } = await exportModel(id);
    let binary = "";
    for (const byte of new Uint8Array(buffer))
      binary += String.fromCharCode(byte);
    result[id] = { glb: btoa(binary), ...stats };
  }
  return result;
}
Object.assign(window, { exportAll });

const list = document.querySelector("#list")!;
for (const id of Object.keys(builders)) {
  const button = document.createElement("button");
  button.textContent = id;
  button.style.margin = "4px";
  button.onclick = async () => {
    const { buffer } = await exportModel(id);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([buffer], { type: "model/gltf-binary" }),
    );
    link.download = `${id.split("/")[1]}.glb`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  list.append(button);
}
