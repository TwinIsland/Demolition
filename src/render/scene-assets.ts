import { LoadingManager } from "three";

export type LoadProgress = (done: number, total: number) => void;

/** Tracks the real loader queue, including nested GLTF requests and skin decoding. */
export class SceneAssets {
  readonly manager = new LoadingManager();
  private done = 0;
  private total = 0;
  private idle: Promise<void> = Promise.resolve();
  private finish?: () => void;
  private report?: LoadProgress;

  constructor() {
    const progress = (_url: string, done: number, total: number) => {
      this.done = done;
      this.total = total;
      this.report?.(done,total);
    };
    this.manager.onStart = (url,done,total) => {
      this.idle = new Promise(resolve => { this.finish = resolve; });
      progress(url,done,total);
    };
    this.manager.onProgress = progress;
    this.manager.onLoad = () => this.finish?.();
  }
  watch(report: LoadProgress) {
    const baseline = this.done;
    this.report = (done,total) => report(done - baseline, total - baseline);
    this.report(this.done,this.total);
    return () => { this.report = undefined; };
  }
  ready() { return this.idle; }
}
