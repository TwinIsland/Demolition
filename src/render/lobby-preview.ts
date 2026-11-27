import * as THREE from "three";
import { MinecraftAvatar } from "./minecraft-avatar";
import type { Models } from "./models";
import type { Appearance } from "../core/room";
import { MapBackdrop } from "./map-backdrop";

/** How the preview's head follows the pointer. Angles in radians. */
const GAZE = {
  /** World distance in front of the avatar of the plane the pointer is imagined on. */
  depth: 1.5,
  /** Height of the head centre above the avatar's feet. */
  headHeight: 1.6,
  maxYaw: 1.05,
  maxUp: 0.5,
  maxDown: 0.65,
  /** Past this body turn the pointer is behind the avatar, and the head stops following. */
  blindYaw: 2.1,
  /** Damping rates: of the head towards its target, and of following switching on and off. */
  follow: 9,
  engage: 5,
} as const;

/** A second scene drawn into a clipped region of the existing WebGL surface. */
export class LobbyPreview {
  private scene = new THREE.Scene();
  readonly backdrop: MapBackdrop;
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 12);
  private avatar = new MinecraftAvatar();
  private style?: Appearance["bombStyle"];
  private knife?: Appearance["knifeStyle"];
  private viewport = new THREE.Vector4();
  private scissor = new THREE.Vector4();
  private yaw = Math.PI - 0.34;
  private targetYaw = this.yaw;
  private lastTime = 0;
  private controller = new AbortController();
  private skinTicket = 0;
  /**
   * The canvas itself is not multisampled, so the operator is drawn into a multisampled buffer
   * and copied over the backdrop from there.
   */
  private target = new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType });
  private clearColor = new THREE.Color();
  private copyScene = new THREE.Scene();
  private copyCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private copy = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: { image: { value: this.target.texture } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      vertexShader: "varying vec2 at; void main() { at = uv; gl_Position = vec4(position.xy, 0., 1.); }",
      // The resolved edge texels are premultiplied by their coverage.
      fragmentShader: `
        uniform sampler2D image; varying vec2 at;
        void main() {
          vec4 texel = texture2D(image, at);
          gl_FragColor = vec4(texel.rgb / max(texel.a, 1e-4), texel.a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  /** Last pointer position in client pixels; unset until the pointer moves over the page. */
  private pointer?: { x: number; y: number };
  private dragging = false;
  /** Smoothed head turn towards the pointer, and how strongly it replaces the idle motion. */
  private gaze = { yaw: 0, pitch: 0, weight: 0 };
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
    this.copy.frustumCulled = false;
    this.copyScene.add(this.copy);
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
        this.dragging = true;
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
        this.dragging = false;
      },
      options,
    );
    window.addEventListener(
      "pointermove",
      (e) => {
        if (e.pointerType === "mouse" || e.pointerType === "pen")
          this.pointer = { x: e.clientX, y: e.clientY };
      },
      options,
    );
    // The pointer left the page: let the head drift back to its idle motion.
    document.documentElement.addEventListener("pointerleave", () => (this.pointer = undefined), options);
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
    // The hand shows whichever was changed last; on the first call that is the charge.
    if (this.knife !== look.knifeStyle) {
      this.knife = look.knifeStyle;
      this.avatar.hold(this.models.item("knife", false, this.knife), "melee");
    }
    if (this.style !== look.bombStyle) {
      this.style = look.bombStyle;
      this.avatar.hold(this.models.explosive("#f07066", 70, this.style, undefined, true), "bomb");
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
    const aspect = rect.width / rect.height,
      half = Math.max(1.11, 0.9 / aspect);
    this.followPointer(rect, half, dt);
    const idle = 1 - 0.85 * this.gaze.weight;
    body.head.rotation.order = "YXZ";
    body.head.rotation.set(
      0.15 * inspect * idle + this.gaze.pitch * this.gaze.weight,
      (0.17 * Math.sin(time * 0.68) - 0.2 * inspect) * idle + this.gaze.yaw * this.gaze.weight,
      0,
    );
    body.rightArm.rotation.set(-0.82 - 0.38 * inspect, -0.1, -0.13);
    body.leftArm.rotation.set(0.09 * breathe, 0, -0.09 - 0.02 * breathe);
    body.rightLeg.rotation.x = 0.045 * breathe;
    body.leftLeg.rotation.x = -0.045 * breathe;
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
    const ratio = renderer.getPixelRatio(),
      width = Math.max(1, Math.round(rect.width * ratio)),
      height = Math.max(1, Math.round(rect.height * ratio));
    if (this.target.width !== width || this.target.height !== height) this.target.setSize(width, height);
    const alpha = renderer.getClearAlpha();
    renderer.getClearColor(this.clearColor);
    renderer.setRenderTarget(this.target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(null);
    renderer.setClearColor(this.clearColor, alpha);
    renderer.autoClear = false;
    renderer.render(this.copyScene, this.copyCamera);
    renderer.autoClear = auto;
    renderer.setViewport(this.viewport);
    renderer.setScissor(this.scissor);
    renderer.setScissorTest(clipped);
  }
  /**
   * Turns the head towards the pointer. `half` is half the height of the view in world units.
   * The pointer is taken to lie on a plane in front of the avatar, so the turn grows smoothly
   * with distance and is clamped to what a neck can do.
   */
  private followPointer(rect: DOMRect, half: number, dt: number) {
    const { clamp, damp } = THREE.MathUtils;
    // Body turn away from the camera, wrapped to [-PI, PI]; the rig itself is mounted facing backwards.
    const bodyYaw = Math.atan2(Math.sin(this.yaw - Math.PI), Math.cos(this.yaw - Math.PI));
    let yaw = 0,
      pitch = 0,
      following = false;
    if (this.pointer && !this.dragging && Math.abs(bodyYaw) < GAZE.blindYaw) {
      const worldPerPixel = (2 * half) / rect.height;
      // The camera looks at y = 0.88, which lands on the middle of the surface.
      const headY = rect.top + rect.height / 2 - (GAZE.headHeight - 0.88) / worldPerPixel;
      const dx = (this.pointer.x - (rect.left + rect.width / 2)) * worldPerPixel;
      const dy = (this.pointer.y - headY) * worldPerPixel;
      yaw = clamp(Math.atan2(dx, GAZE.depth) - bodyYaw, -GAZE.maxYaw, GAZE.maxYaw);
      pitch = clamp(Math.atan2(dy, GAZE.depth), -GAZE.maxUp, GAZE.maxDown);
      following = true;
    }
    this.gaze.weight = damp(this.gaze.weight, following ? 1 : 0, GAZE.engage, dt);
    // While disengaging the last direction is kept, so the head eases out instead of snapping.
    if (!following) return;
    this.gaze.yaw = damp(this.gaze.yaw, yaw, GAZE.follow, dt);
    this.gaze.pitch = damp(this.gaze.pitch, pitch, GAZE.follow, dt);
  }
  dispose() {
    this.controller.abort();
    this.backdrop.dispose();
    this.skinTicket++;
    this.avatar.dispose();
    this.target.dispose();
    this.copy.geometry.dispose();
    this.copy.material.dispose();
  }
}
