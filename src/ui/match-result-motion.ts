import { animate, stagger } from "motion";

/**
 * Reveal of the after-action screen, in four beats: the headline slams in at the centre, docks
 * to the top as the scoreboard arrives, the experience bar runs through the levels gained, and
 * the highlights land. The stage is published as `data-stage` so the stylesheet keeps later
 * blocks out of sight; every animation ends at the resting style. The reveal cannot be skipped:
 * the buttons unlock when it is over.
 */
const EASE = [0.2, 0.75, 0.25, 1] as const;
const SLAM = [0.16, 1, 0.3, 1] as const;
/** Where the headline sits during the first beat, as a share of the screen height. */
const CENTRE = 0.44;
const BANNER_SCALE = 1.45;
const BANNER_HOLD_MS = 1750;
const BOARD_MS = 1250;
const COUNT_SECONDS = 0.9;
/** Longest the bar spends on the levels gained, however many there were. */
const LEVELS_SECONDS = 1.5;
const LEVEL_SECONDS = 0.34;

const all = (root: ParentNode, selector: string) => [...root.querySelectorAll<HTMLElement>(selector)];

function countUp(elements: readonly HTMLElement[], tick: () => void, delay = 0) {
  const targets = elements.map((element) => Number(element.dataset.count) || 0);
  elements.forEach((element) => (element.textContent = "0"));
  let shown = 0;
  animate(0, 1, {
    duration: COUNT_SECONDS,
    delay,
    ease: "easeOut",
    onUpdate: (progress) => {
      elements.forEach((element, i) => (element.textContent = String(Math.round(targets[i] * progress))));
      // One tick per visible step of the largest figure, which the caller rate-limits.
      const step = Math.round(progress * 24);
      if (step !== shown) {
        shown = step;
        tick();
      }
    },
  });
}

async function runLevels(xp: HTMLElement, tick: () => void) {
  const fill = xp.querySelector<HTMLElement>(".rs-xp-fill"),
    label = xp.querySelector<HTMLElement>(".rs-xp-level b");
  if (!fill || !label) return;
  const level = Number(xp.dataset.level) || 1,
    fraction = Number(xp.dataset.fraction) || 0;
  const each = Math.min(LEVEL_SECONDS, LEVELS_SECONDS / Math.max(1, level - 1));
  for (let reached = 1; reached < level; reached++) {
    label.textContent = String(reached);
    await animate(fill, { scaleX: [0, 1] }, { duration: each, ease: "linear" });
    if (!xp.isConnected) return;
    label.textContent = String(reached + 1);
    animate(label, { scale: [1.7, 1] }, { duration: 0.3, ease: EASE });
    animate(xp, { filter: ["brightness(1.9)", "brightness(1)"] }, { duration: 0.3 });
    tick();
  }
  label.textContent = String(level);
  await animate(fill, { scaleX: [0, fraction] }, { duration: 0.5, ease: EASE });
}

/**
 * Plays the reveal on a freshly mounted screen. `tick` sounds the counters. Returns a function
 * that ends it at the final state; it is for teardown, not for the player.
 */
export function playResult(root: HTMLElement, tick: () => void): () => void {
  const buttons = all(root, "button") as HTMLButtonElement[];
  const banner = root.querySelector<HTMLElement>(".rs-banner");
  let timer = 0;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    root.dataset.stage = "done";
    if (banner) animate(banner, { y: 0, scale: 1 }, { duration: 0 });
    buttons.forEach((button) => (button.disabled = false));
    if (root.isConnected) (root.querySelector<HTMLElement>(".rs-btn-primary") ?? buttons[0])?.focus();
  };
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    finish();
    return finish;
  }
  /** Resolves false when the screen was closed, or the reveal ended, while waiting. */
  const wait = (ms: number) =>
    new Promise<boolean>((resolve) => {
      timer = window.setTimeout(() => resolve(root.isConnected && !done), ms);
    });
  buttons.forEach((button) => (button.disabled = true));

  const sequence = async () => {
    // Beat 1: the headline, alone in the middle of the screen.
    root.dataset.stage = "banner";
    if (!banner) return finish();
    const box = banner.getBoundingClientRect();
    const lift = innerHeight * CENTRE - (box.top + box.height / 2);
    animate(banner, { y: lift, scale: BANNER_SCALE }, { duration: 0 });
    animate(all(root, ".rs-flash"), { opacity: [0.85, 0] }, { duration: 0.7, ease: "easeOut" });
    animate(all(root, ".rs-band"), { scaleX: [0, 1], opacity: [0, 1] }, { duration: 0.42, ease: SLAM });
    animate(
      all(root, ".rs-banner h2"),
      { opacity: [0, 1], scale: [2.6, 1], filter: ["blur(18px)", "blur(0px)"] },
      { duration: 0.5, delay: 0.14, ease: SLAM },
    );
    animate(all(root, ".rs-ghost"), { opacity: [0, 1], x: ["8%", "0%"] }, { duration: 1.8, ease: "easeOut" });
    animate(
      all(root, ".rs-kicker, .rs-sub"),
      { opacity: [0, 1], y: [14, 0] },
      { duration: 0.4, ease: EASE, delay: stagger(0.12, { startDelay: 0.55 }) },
    );
    if (!(await wait(BANNER_HOLD_MS))) return;

    // Beat 2: the headline docks and the scoreboard comes in around it.
    root.dataset.stage = "board";
    animate(banner, { y: 0, scale: 1 }, { duration: 0.55, ease: EASE });
    animate(
      all(root, ".rs-operator"),
      { opacity: [0, 1], x: [-48, 0] },
      { duration: 0.45, ease: EASE, delay: 0.15 },
    );
    animate(
      all(root, ".rs-board-head"),
      { opacity: [0, 1], y: [10, 0] },
      { duration: 0.3, ease: EASE, delay: 0.2 },
    );
    animate(
      all(root, ".rs-row"),
      { opacity: [0, 1], x: [64, 0] },
      { duration: 0.38, ease: EASE, delay: stagger(0.06, { startDelay: 0.28 }) },
    );
    countUp(all(root, ".rs-body [data-count]"), tick, 0.35);
    if (!(await wait(BOARD_MS))) return;

    // Beat 3: experience.
    const xp = root.querySelector<HTMLElement>(".rs-xp");
    if (xp) await runLevels(xp, tick);
    if (!root.isConnected || done) return;

    // Beat 4: medals and highlights, then the buttons.
    root.dataset.stage = "highlights";
    animate(
      all(root, ".rs-medals .rs-medal"),
      { opacity: [0, 1], scale: [1.8, 1] },
      { duration: 0.32, ease: SLAM, delay: stagger(0.05) },
    );
    animate(
      all(root, ".rs-highlights h3, .rs-card"),
      { opacity: [0, 1], y: [22, 0] },
      { duration: 0.36, ease: EASE, delay: stagger(0.08, { startDelay: 0.1 }) },
    );
    if (!(await wait(650))) return;
    finish();
    animate(
      all(root, ".rs-btn"),
      { opacity: [0, 1], y: [10, 0] },
      { duration: 0.3, ease: EASE, delay: stagger(0.05) },
    );
  };
  // A failed animation must never leave the buttons locked.
  sequence().catch(finish);
  return finish;
}
