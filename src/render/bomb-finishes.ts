import * as THREE from "three";
import type { BombFinish } from "../core/pack-api";

/** Material slots authored on the bomb GLB. All instances share maps and finishes. */
export class BombFinishes {
  private materials = new Map<string, THREE.MeshStandardMaterial>();
  private maps = new Map<string, THREE.Texture>();
  private loader: THREE.TextureLoader;
  constructor(manager: THREE.LoadingManager) {
    this.loader = new THREE.TextureLoader(manager);
  }

  private texture(url: string, color: boolean, tier?: number) {
    const key = JSON.stringify([url, color, tier]);
    let map = this.maps.get(key);
    if (!map) {
      map = this.loader.load(url);
      map.flipY = false;
      map.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      map.wrapS = THREE.RepeatWrapping;
      map.anisotropy = 4;
      if (tier !== undefined) {
        map.repeat.y = 1 / 3;
        map.offset.y = tier / 3;
      }
      this.maps.set(key, map);
    }
    return map;
  }
  get(role: string, finish: BombFinish, tier: number, owner: string) {
    const key =
      role === "Cord" ? role : role === "Collar" ? role + owner + tier : role + ":" + finish.id + ":" + tier;
    let material = this.materials.get(key);
    if (material) return material;
    const props: THREE.MeshStandardMaterialParameters = {};
    switch (role) {
      case "Wrap":
        props.color = new THREE.Color(finish.colors[tier]);
        if (finish.texture) {
          props.map = this.texture(finish.texture, true);
          props.color.lerp(new THREE.Color(0xffffff), 1 - tier * 0.09);
        }
        if (finish.roughnessMap) props.roughnessMap = this.texture(finish.roughnessMap, false);
        props.roughness = finish.roughness ?? 0.85;
        props.metalness = finish.metalness ?? 0.05;
        break;
      case "Collar":
        props.map = this.texture("./assets/bomb-ranks.svg", true, tier);
        props.color = owner;
        props.roughness = 0.51;
        props.metalness = 0.48;
        break;
      case "Caps":
        props.map = this.texture("./assets/bomb-hardware.webp", true);
        props.color = new THREE.Color(finish.capColor ?? "#7c7870").lerp(new THREE.Color(0xffffff), 0.48);
        props.metalness = 0.64;
        props.roughness = 0.48;
        break;
      default:
        props.color = "#413b30";
        props.roughness = 0.94;
    }
    material = new THREE.MeshStandardMaterial(props);
    this.materials.set(key, material);
    return material;
  }
  dispose() {
    this.materials.forEach((material) => material.dispose());
    this.maps.forEach((map) => map.dispose());
  }
}
