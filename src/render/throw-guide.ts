import * as THREE from "three";
import { throwPoint } from "../core/throw-path";
import type { Player, Vec2 } from "../core/types";
import { TILE_SIZE, world } from "./arena";

const SEGMENTS = 48;
const landingColor = (valid: boolean) => (valid ? "#65ffcf" : "#ff7669");

function landingArt(valid: boolean, badge: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const ink = "#101b20",
    accent = landingColor(valid);
  ctx.translate(64, 64);
  ctx.lineJoin = ctx.lineCap = "round";
  ctx.beginPath();
  if (badge) {
    ctx.moveTo(-34, -48);
    ctx.lineTo(34, -48);
    ctx.lineTo(40, -41);
    ctx.lineTo(40, 5);
    ctx.lineTo(0, 54);
    ctx.lineTo(-40, 5);
    ctx.lineTo(-40, -41);
    ctx.closePath();
  } else ctx.arc(0, 0, 50, 0, Math.PI * 2);
  ctx.fillStyle = badge ? ink : valid ? "#40e5aa38" : "#f552493b";
  ctx.fill();
  ctx.lineWidth = badge ? 12 : 15;
  ctx.strokeStyle = ink;
  ctx.stroke();
  ctx.lineWidth = badge ? 6 : 7;
  ctx.strokeStyle = accent;
  ctx.stroke();
  ctx.beginPath();
  if (!valid) {
    const y = badge ? -11 : 0;
    ctx.moveTo(-13, y - 13);
    ctx.lineTo(13, y + 13);
    ctx.moveTo(13, y - 13);
    ctx.lineTo(-13, y + 13);
  } else if (badge) {
    ctx.moveTo(-19, -16);
    ctx.lineTo(0, 3);
    ctx.lineTo(19, -16);
  } else {
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.moveTo(0, 36);
      ctx.lineTo(0, 56);
    }
  }
  ctx.lineWidth = 11;
  ctx.strokeStyle = ink;
  ctx.stroke();
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#f5ffff";
  ctx.stroke();
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

export class ThrowGuide {
  readonly root = new THREE.Group();
  private arc = new THREE.Group();
  private geometry = new THREE.BufferGeometry();
  private positions = new THREE.Float32BufferAttribute(new Float32Array((SEGMENTS + 1) * 3), 3).setUsage(
    THREE.DynamicDrawUsage,
  );
  private distances = new THREE.Float32BufferAttribute(new Float32Array(SEGMENTS + 1), 1).setUsage(
    THREE.DynamicDrawUsage,
  );
  private solid = new THREE.LineBasicMaterial({
    transparent: true,
    opacity: 0.97,
    depthWrite: false,
    toneMapped: false,
  });
  private hidden = new THREE.LineDashedMaterial({
    transparent: true,
    opacity: 0.52,
    dashSize: 0.17,
    gapSize: 0.14,
    depthFunc: THREE.GreaterDepth,
    depthWrite: false,
    toneMapped: false,
  });
  private pin = new THREE.Group();
  private art = [false, true].map((valid) => ({
    floor: landingArt(valid, false),
    badge: landingArt(valid, true),
  }));
  private floor = new THREE.Mesh(
    new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE),
    new THREE.MeshBasicMaterial({
      map: this.art[1].floor,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    }),
  );
  private badge = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: this.art[1].badge,
      transparent: true,
      sizeAttenuation: false,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    }),
  );
  private point = new THREE.Vector3();
  private previous = new THREE.Vector3();
  constructor() {
    this.geometry.setAttribute("position", this.positions);
    this.geometry.setAttribute("lineDistance", this.distances);
    for (const mat of [this.hidden, this.solid]) {
      const line = new THREE.Line(this.geometry, mat);
      line.frustumCulled = false;
      line.renderOrder = 7;
      this.arc.add(line);
    }
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.renderOrder = 8;
    this.badge.center.set(0.5, 0.09);
    this.badge.scale.set(0.062, 0.062, 1);
    this.badge.position.y = 0.35;
    this.badge.renderOrder = 9;
    this.pin.add(this.floor, this.badge);
    this.root.add(this.arc, this.pin);
    this.root.visible = false;
  }
  update(origin: Player, cell: Vec2, size: number, valid: boolean, lob: boolean, time: number) {
    this.arc.visible = lob;
    this.pin.position.set(world(cell.x, size), 0.055, world(cell.z, size));
    const art = this.art[Number(valid)];
    this.floor.material.map = art.floor;
    this.badge.material.map = art.badge;
    this.floor.scale.setScalar(0.96 + 0.035 * Math.sin(time * 4.5));
    if (!lob) return;
    let length = 0;
    for (let i = 0; i <= SEGMENTS; i++) {
      const p = throwPoint(this.point, origin, cell, i / SEGMENTS, "lob");
      p.x = world(p.x, size);
      p.z = world(p.z, size);
      this.positions.setXYZ(i, p.x, p.y, p.z);
      if (i) length += this.point.distanceTo(this.previous);
      this.distances.setX(i, length);
      this.previous.copy(this.point);
    }
    this.positions.needsUpdate = this.distances.needsUpdate = true;
    this.solid.color.set(landingColor(valid));
    this.hidden.color.copy(this.solid.color);
  }
  dispose() {
    this.geometry.dispose();
    this.floor.geometry.dispose();
    this.floor.material.dispose();
    this.badge.material.dispose();
    this.art.forEach(({ floor, badge }) => {
      floor.dispose();
      badge.dispose();
    });
    this.solid.dispose();
    this.hidden.dispose();
  }
}
