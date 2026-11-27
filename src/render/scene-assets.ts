import { LoadingManager } from "three";

export type LoadProgress = (done: number, total: number, item?: string) => void;

/** Tracks the real loader queue, including nested GLTF requests and skin decoding. */
export class SceneAssets {
  readonly manager = new LoadingManager();
  private done = 0;
  private total = 0;
  private idle: Promise<void> = Promise.resolve();
  private finish?: () => void;
  private report?: LoadProgress;

  constructor() {
    const progress = (url: string, done: number, total: number) => {
      this.done = done;
      this.total = total;
      this.report?.(done, total, url.split(/[?#]/)[0].split("/").pop() || "Models");
    };
    this.manager.onStart = (url, done, total) => {
      this.idle = new Promise((resolve) => {
        this.finish = resolve;
      });
      progress(url, done, total);
    };
    this.manager.onProgress = progress;
    this.manager.onLoad = () => this.finish?.();
  }
  watch(report: LoadProgress) {
    const baseline = this.done;
    this.report = (done, total, item) => report(done - baseline, total - baseline, item);
    this.phase("Models");
    return () => {
      this.report = undefined;
    };
  }
  ready() {
    return this.idle;
  }
  phase(item: string) {
    this.report?.(this.done, this.total, item);
  }
}
