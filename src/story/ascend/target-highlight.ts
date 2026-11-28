import * as THREE from "three";
import type { Player } from "../../core/types";
import { world } from "../../render/arena";
import { t } from "../../i18n";

/** A tutorial target stays legible through scenery, including the shop between it and the hero. */
export class TargetHighlight {
  private root = new THREE.Group();
  private bodyGeometry = new THREE.BoxGeometry(1.3, 2.15, 1.05);
  private bodyMaterial = new THREE.MeshBasicMaterial({
    color: "#ffd65c",
    transparent: true,
    opacity: 0.12,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
  private edgeGeometry = new THREE.EdgesGeometry(this.bodyGeometry);
  private edgeMaterial = new THREE.LineBasicMaterial({
    color: "#ffe387",
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
  private labelTexture: THREE.CanvasTexture;
  private labelMaterial: THREE.SpriteMaterial;
  private disposed = false;

  constructor(parent: THREE.Object3D) {
    const body = new THREE.Mesh(this.bodyGeometry, this.bodyMaterial);
    const edges = new THREE.LineSegments(this.edgeGeometry, this.edgeMaterial);
    body.position.y = edges.position.y = 1.08;
    body.renderOrder = 10;
    edges.renderOrder = 11;
    const canvas = document.createElement("canvas");
    canvas.width = 384;
    canvas.height = 128;
    const ink = canvas.getContext("2d")!;
    ink.fillStyle = "#111822";
    ink.fillRect(4, 4, 376, 98);
    ink.strokeStyle = "#ffe387";
    ink.lineWidth = 5;
    ink.strokeRect(4, 4, 376, 98);
    ink.textAlign = "center";
    ink.fillStyle = "#fff0b0";
    ink.font = 'bold 36px "Noto Sans SC", sans-serif';
    ink.fillText(t("训练靶"), 192, 46);
    ink.font = '22px "Noto Sans SC", sans-serif';
    ink.fillText(t("击倒它以升级"), 192, 81);
    ink.fillStyle = "#ffe387";
    ink.beginPath();
    ink.moveTo(174, 105);
    ink.lineTo(210, 105);
    ink.lineTo(192, 128);
    ink.fill();
    this.labelTexture = new THREE.CanvasTexture(canvas);
    this.labelTexture.colorSpace = THREE.SRGBColorSpace;
    this.labelMaterial = new THREE.SpriteMaterial({
      map: this.labelTexture,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      fog: false,
      sizeAttenuation: false,
    });
    const label = new THREE.Sprite(this.labelMaterial);
    label.position.y = 2.75;
    label.scale.set(0.21, 0.07, 1);
    label.renderOrder = 12;
    this.root.add(body, edges, label);
    parent.add(this.root);
  }

  update(target: Readonly<Player> | undefined, size: number) {
    this.root.visible = !!target?.alive;
    if (target) this.root.position.set(world(target.x, size), target.elevation, world(target.z, size));
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.bodyGeometry.dispose();
    this.bodyMaterial.dispose();
    this.edgeGeometry.dispose();
    this.edgeMaterial.dispose();
    this.labelTexture.dispose();
    this.labelMaterial.dispose();
  }
}
