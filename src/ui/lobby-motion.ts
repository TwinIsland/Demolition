import { animate, stagger } from "motion";

/**
 * Transition choreography of the lobby menu. Every animation runs towards the element's resting
 * style, so the menu stays usable when an animation is skipped or interrupted.
 */
const EASE = [0.2, 0.75, 0.25, 1] as const;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

/** Puts elements back at rest, ending whatever was animating them. */
export function settle(elements: readonly HTMLElement[]) {
  if (elements.length) animate([...elements], { opacity: 1, x: 0, y: 0 }, { duration: 0 });
}

/** Slides rows in one after another from the side the menu is moving away from. */
export function rowsIn(rows: readonly HTMLElement[], direction: 1 | -1, delay = 0) {
  if (!rows.length) return;
  if (reducedMotion.matches) return settle(rows);
  animate(
    [...rows],
    { opacity: [0, 1], x: [36 * direction, 0], y: 0 },
    { duration: 0.34, ease: EASE, delay: stagger(0.035, { startDelay: delay }) },
  );
}

/** Slides rows out; resolves when they are gone. */
export async function rowsOut(rows: readonly HTMLElement[], direction: 1 | -1) {
  if (!rows.length || reducedMotion.matches) return;
  await animate(
    [...rows],
    { opacity: 0, x: -28 * direction },
    { duration: 0.13, ease: "easeIn", delay: stagger(0.012) },
  );
}

/** Lifts a block into place: titles, the detail card, the footer. */
export function rise(elements: readonly HTMLElement[], delay = 0, distance = 14) {
  if (!elements.length) return;
  if (reducedMotion.matches) return settle(elements);
  animate(
    [...elements],
    { opacity: [0, 1], y: [distance, 0], x: 0 },
    { duration: 0.3, ease: EASE, delay: stagger(0.05, { startDelay: delay }) },
  );
}

/** Brings a block in from the right edge. */
export function slideIn(element: HTMLElement, delay = 0) {
  if (reducedMotion.matches) return settle([element]);
  animate(element, { opacity: [0, 1], x: [56, 0], y: 0 }, { duration: 0.42, ease: EASE, delay });
}

/** A band of light crossing the screen, covering a backdrop change. */
export function wipe(band: HTMLElement) {
  if (reducedMotion.matches) return;
  animate(band, { x: ["-120%", "340%"], opacity: [0, 1, 0] }, { duration: 0.55, ease: "easeOut" });
}
