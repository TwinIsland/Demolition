import * as THREE from "three";
import { MinecraftAvatar } from "./minecraft-avatar";
import type { MinecraftSkin } from "./minecraft-skins";

/** Four scissored portraits share one transparent canvas while the room is open. */
export class PlayerPortraits {
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 12);
  private renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  private seats = new Map<number, { avatar: MinecraftAvatar; anchor: HTMLElement }>();
  private nextFrame = 0;
  private width = 0;
  private height = 0;

  constructor(resolution: number) {
    this.setResolution(resolution);
    this.renderer.setClearColor(0, 0);
    this.renderer.autoClear = false;
    this.renderer.info.autoReset = false;
    this.renderer.domElement.className = "room-models";
    this.renderer.domElement.setAttribute("aria-hidden", "true");
    this.scene.add(new THREE.HemisphereLight(0xf2f2df, 0x797e83, 1.65));
    const key = new THREE.DirectionalLight(0xffe2b8, 2);
    key.position.set(-3, 4, 3);
    const rim = new THREE.DirectionalLight(0x9fcfea, 1.5);
    rim.position.set(2, 3, -2);
    this.scene.add(key, rim);
    this.camera.position.set(0, 1.15, 4);
    this.camera.lookAt(0, 0.91, 0);
  }
  setResolution(ratio: number) {
    this.renderer.setPixelRatio(Math.min(1.5, ratio));
  }
  set(anchor: HTMLElement, skin: MinecraftSkin, index: number) {
    const host = anchor.closest<HTMLElement>(".room-roster")!;
    if (this.renderer.domElement.parentElement !== host) host.append(this.renderer.domElement);
    let seat = this.seats.get(index);
    if (!seat) {
      seat = { avatar: new MinecraftAvatar(), anchor };
      this.scene.add(seat.avatar);
      this.seats.set(index, seat);
    }
    seat.anchor = anchor;
    seat.avatar.setSkin(skin);
    this.nextFrame = 0;
  }
  draw(time: number) {
    const canvas = this.renderer.domElement;
    if (!canvas.isConnected || time < this.nextFrame) return;
    this.nextFrame = time + 1 / 30;
    const rect = canvas.getBoundingClientRect();
    const w = Math.round(rect.width),
      h = Math.round(rect.height);
    if (!w || !h) return;
    if (w !== this.width || h !== this.height) {
      this.renderer.setSize(w, h, false);
      this.width = w;
      this.height = h;
    }
    this.renderer.setScissorTest(false);
    this.renderer.info.reset();
    this.renderer.clear();
    this.renderer.setScissorTest(true);
    for (const { avatar } of this.seats.values()) avatar.visible = false;
    for (const [index, { anchor, avatar }] of this.seats) {
      if (!anchor.isConnected || anchor.closest(".empty")) continue;
      const box = anchor.getBoundingClientRect();
      if (!box.width || !box.height) continue;
      const phase = index * 1.85,
        breathe = Math.sin(time * 1.7 + phase),
        glance = Math.sin(time * 0.58 + phase);
      const turn = [0.38, -0.36, 0.28, -0.25][index] ?? 0;
      const body = avatar.rig.skin;
      avatar.visible = true;
      avatar.rotation.y = Math.PI + turn + 0.035 * glance;
      body.body.rotation.z = 0.014 * breathe;
      body.head.rotation.set(0.045 + 0.045 * breathe, -turn * 0.6 + 0.16 * glance, 0.025 * glance);
      body.rightArm.rotation.set(-0.26 - index * 0.05 + 0.095 * breathe, 0, 0.065 + 0.018 * breathe);
      body.leftArm.rotation.set(0.08 + index * 0.07 - 0.09 * breathe, 0, -0.07 - 0.018 * breathe);
      body.leftLeg.rotation.x = -0.105;
      body.rightLeg.rotation.x = 0.1;
      const aspect = box.width / box.height,
        half = Math.max(1.03, 0.58 / aspect);
      this.camera.left = -half * aspect;
      this.camera.right = half * aspect;
      this.camera.top = half;
      this.camera.bottom = -half;
      this.camera.updateProjectionMatrix();
      this.renderer.setViewport(box.left - rect.left, rect.bottom - box.bottom, box.width, box.height);
      this.renderer.setScissor(box.left - rect.left, rect.bottom - box.bottom, box.width, box.height);
      this.renderer.render(this.scene, this.camera);
      avatar.visible = false;
    }
    return this.renderer;
  }
  dispose() {
    this.seats.forEach((s) => s.avatar.dispose());
    this.renderer.domElement.remove();
    this.renderer.dispose();
  }
}
