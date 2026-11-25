import * as THREE from "three";
import { MinecraftAvatar } from "./minecraft-avatar";
import type { Models } from "./models";
import type { Appearance } from "../core/room";
import { MapBackdrop } from "./map-backdrop";

/** A second scene drawn into a clipped region of the existing WebGL surface. */
export class LobbyPreview {
  private scene = new THREE.Scene();
  readonly backdrop: MapBackdrop;
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 12);
  private avatar = new MinecraftAvatar();
  private style?: Appearance["bombStyle"];
  private viewport = new THREE.Vector4();
  private scissor = new THREE.Vector4();
  private yaw = Math.PI - 0.34;
  private targetYaw = this.yaw;
  private lastTime = 0;
  private controller = new AbortController();
  private skinTicket = 0;
  constructor(
    private models: Models,
    private surface: HTMLElement,
    manager: THREE.LoadingManager,
  ) {
    this.backdrop = new MapBackdrop(manager);
    this.scene.add(this.avatar, new THREE.HemisphereLight(0xf6f6ea, 0xb2aa95, 1.8));
    const key = new THREE.DirectionalLight(0xffe5bd, 2.1);
    key.position.set(-3, 4, 4);
    const rim = new THREE.DirectionalLight(0xb1d9f0, 1.8);
    rim.position.set(2, 2, -2);
    this.scene.add(key, rim);
    this.camera.position.set(0, 1.48, 4);
    this.camera.lookAt(0, 0.88, 0);
    let pointer: number | undefined,
      lastX = 0;
    const options = { signal: this.controller.signal };
    surface.addEventListener(
      "pointerdown",
      (e) => {
        if (e.button !== 0 || pointer !== undefined) return;
        surface.setPointerCapture(e.pointerId);
        pointer = e.pointerId;
        lastX = e.clientX;
      },
      options,
    );
    surface.addEventListener(
      "pointermove",
      (e) => {
        if (e.pointerId !== pointer) return;
        this.targetYaw += (e.clientX - lastX) * 0.014;
        lastX = e.clientX;
      },
      options,
    );
    surface.addEventListener(
      "lostpointercapture",
      () => {
        pointer = undefined;
      },
      options,
    );
    surface.addEventListener(
      "keydown",
      (e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        this.targetYaw += e.key === "ArrowRight" ? 0.25 : -0.25;
      },
      options,
    );
  }
  async dress(look: Appearance) {
    if (this.style !== look.bombStyle) {
      this.style = look.bombStyle;
      this.avatar.hold(this.models.explosive("#f07066", 70, this.style), "bomb");
    }
    const ticket = ++this.skinTicket;
    const skin = await this.models.localSkin(look.skin);
    if (ticket === this.skinTicket) this.avatar.setSkin(skin);
  }
  render(renderer: THREE.WebGLRenderer, time: number) {
    const rect = this.surface.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const canvas = renderer.domElement.getBoundingClientRect();
    const dt = Math.min(0.05, Math.max(0, time - this.lastTime));
    this.lastTime = time;
    this.yaw = THREE.MathUtils.damp(this.yaw, this.targetYaw, 24, dt);
    const breathe = Math.sin(time * 1.8),
      inspect = (1 + Math.cos(time * 0.83)) ** 5 / 32;
    this.avatar.rotation.y = this.yaw;
    const body = this.avatar.rig.skin;
    body.head.rotation.set(0.15 * inspect, 0.17 * Math.sin(time * 0.68) - 0.2 * inspect, 0);
    body.rightArm.rotation.set(-0.82 - 0.38 * inspect, -0.1, -0.13);
    body.leftArm.rotation.set(0.09 * breathe, 0, -0.09 - 0.02 * breathe);
    body.rightLeg.rotation.x = 0.045 * breathe;
    body.leftLeg.rotation.x = -0.045 * breathe;
    const aspect = rect.width / rect.height,
      half = Math.max(1.11, 0.9 / aspect);
    this.camera.top = half;
    this.camera.bottom = -half;
    this.camera.left = -half * aspect;
    this.camera.right = half * aspect;
    this.camera.updateProjectionMatrix();
    renderer.getViewport(this.viewport);
    renderer.getScissor(this.scissor);
    const clipped = renderer.getScissorTest(),
      auto = renderer.autoClear;
    renderer.setViewport(rect.left - canvas.left, canvas.bottom - rect.bottom, rect.width, rect.height);
    renderer.setScissor(rect.left - canvas.left, canvas.bottom - rect.bottom, rect.width, rect.height);
    renderer.setScissorTest(true);
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
    renderer.autoClear = auto;
    renderer.setViewport(this.viewport);
    renderer.setScissor(this.scissor);
    renderer.setScissorTest(clipped);
  }
  dispose() {
    this.controller.abort();
    this.backdrop.dispose();
    this.skinTicket++;
    this.avatar.dispose();
  }
}
