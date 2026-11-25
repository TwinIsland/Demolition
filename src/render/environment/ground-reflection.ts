import * as THREE from "three";
import type { WeatherUniforms } from "./surface-weathering";

/**
 * Planar reflection of the scene in the arena floor.
 *
 * The floor lies in one plane, so rendering the scene from the mirrored camera gives the
 * exact reflection, including objects that are off screen. That is what screen-space
 * reflections cannot do, and with the arena's small draw count a second pass at reduced
 * resolution costs less than a ray-marched one. Roughness is approximated by sampling
 * lower mip levels of the mirrored image.
 */
export class GroundReflection {
  private target: THREE.WebGLRenderTarget;
  private mirror = new THREE.PerspectiveCamera();
  private eye = new THREE.Vector3();
  private anchor = new THREE.Vector3();
  private offset = new THREE.Vector3();
  private lookAt = new THREE.Vector3();
  private rotation = new THREE.Matrix4();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private clip = new THREE.Vector4();
  private q = new THREE.Vector4();
  private viewPlane = new THREE.Plane();
  private size = new THREE.Vector2();
  private hidden: THREE.Object3D[] = [];
  private blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  constructor(
    private uniforms: WeatherUniforms,
    /** Height of the mirror plane in world space. */
    height = 0,
    private scale = 0.25,
  ) {
    this.plane.constant = -height;
    this.blank.needsUpdate = true;
    this.target = new THREE.WebGLRenderTarget(4, 4, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: true,
      depthBuffer: true,
      samples: 0,
    });
    uniforms.wxReflection.value = this.blank;
  }

  /**
   * Render the mirrored view. `exclude` lists objects that must not appear in it, such as
   * the first-person viewmodel and screen-facing effects. Returns false when skipped.
   */
  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, exclude: THREE.Object3D[]) {
    const uniforms = this.uniforms;
    uniforms.wxReflectionOn.value = 0;
    uniforms.wxReflection.value = this.blank;
    const projection = camera.projectionMatrix.elements;
    // Only a true perspective view is mirrored; the blended tactical view keeps the sky reflection.
    if (projection[11] !== -1 || projection[15] !== 0) return false;
    camera.updateMatrixWorld();
    const eye = this.eye.setFromMatrixPosition(camera.matrixWorld);
    if (this.plane.distanceToPoint(eye) <= 0.02) return false;

    renderer.getDrawingBufferSize(this.size);
    const width = Math.max(4, Math.round(this.size.x * this.scale)),
      height = Math.max(4, Math.round(this.size.y * this.scale));
    if (this.target.width !== width || this.target.height !== height) this.target.setSize(width, height);

    // A camera at the mirrored eye, looking at the mirrored target (the construction used by
    // three's Reflector). It is a rotation, so triangle winding is unchanged.
    const up = this.plane.normal;
    const anchor = this.anchor.set(eye.x, -this.plane.constant, eye.z);
    const rotation = this.rotation.extractRotation(camera.matrixWorld);
    const position = this.offset.subVectors(anchor, eye).reflect(up).negate().add(anchor);
    const lookAt = this.lookAt.set(0, 0, -1).applyMatrix4(rotation).add(eye);
    lookAt.subVectors(anchor, lookAt).reflect(up).negate().add(anchor);
    this.mirror.position.copy(position);
    this.mirror.up.set(0, 1, 0).applyMatrix4(rotation).reflect(up);
    this.mirror.lookAt(lookAt);
    this.mirror.updateMatrixWorld();
    this.mirror.projectionMatrix.copy(camera.projectionMatrix);

    // Maps a world position to its texel in the mirrored image.
    uniforms.wxReflectionMatrix.value
      .set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
      .multiply(camera.projectionMatrix)
      .multiply(this.mirror.matrixWorldInverse);

    // Oblique near plane (Lengyel 2005): nothing below the floor may enter the reflection.
    this.viewPlane.copy(this.plane).applyMatrix4(this.mirror.matrixWorldInverse);
    const clip = this.clip.set(
      this.viewPlane.normal.x,
      this.viewPlane.normal.y,
      this.viewPlane.normal.z,
      this.viewPlane.constant,
    );
    const p = this.mirror.projectionMatrix.elements;
    this.q.set((Math.sign(clip.x) + p[8]) / p[0], (Math.sign(clip.y) + p[9]) / p[5], -1, (1 + p[10]) / p[14]);
    clip.multiplyScalar(2 / clip.dot(this.q));
    p[2] = clip.x;
    p[6] = clip.y;
    p[10] = clip.z + 1;
    p[14] = clip.w;
    this.mirror.projectionMatrixInverse.copy(this.mirror.projectionMatrix).invert();

    this.hidden.length = 0;
    for (const object of exclude)
      if (object.visible) {
        object.visible = false;
        this.hidden.push(object);
      }
    const previousTarget = renderer.getRenderTarget(),
      previousShadows = renderer.shadowMap.autoUpdate,
      previousUpdate = renderer.shadowMap.needsUpdate,
      previousXr = renderer.xr.enabled,
      previousSceneUpdate = scene.matrixWorldAutoUpdate;
    renderer.xr.enabled = false;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = false;
    scene.matrixWorldAutoUpdate = false;
    scene.updateMatrixWorld();
    renderer.setRenderTarget(this.target);
    renderer.clear();
    renderer.render(scene, this.mirror);
    renderer.setRenderTarget(previousTarget);
    scene.matrixWorldAutoUpdate = previousSceneUpdate;
    renderer.shadowMap.autoUpdate = previousShadows;
    renderer.shadowMap.needsUpdate = previousUpdate;
    renderer.xr.enabled = previousXr;
    for (const object of this.hidden) object.visible = true;

    uniforms.wxReflection.value = this.target.texture;
    uniforms.wxReflectionOn.value = 1;
    return true;
  }

  /** Stop sampling the mirrored image, for example when the setting is turned off. */
  disable() {
    this.uniforms.wxReflectionOn.value = 0;
    this.uniforms.wxReflection.value = this.blank;
  }

  dispose() {
    this.disable();
    this.target.dispose();
    this.blank.dispose();
  }
}
