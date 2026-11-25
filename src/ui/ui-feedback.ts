/**
 * Menu feedback: a soft tick when the pointer or keyboard focus lands on an
 * interactive control. Click sounds stay with the existing UI click handler.
 * The host passes the cue so this module owns no audio objects.
 */
const INTERACTIVE = "button, select, summary, a.brand, a.icon-btn, label:has(input[type=checkbox])";
const MIN_GAP_MS = 70;

export interface UiFeedbackOptions {
  /** Plays the hover tick, e.g. `() => sound.selectionTick()`. */
  hover(): void;
  /** Return false to stay silent, e.g. while the pointer is locked in combat. */
  active?(): boolean;
}

export function mountUiFeedback(root: HTMLElement, options: UiFeedbackOptions): () => void {
  let last: Element | null = null;
  let lastAt = 0;
  const cue = (target: EventTarget | null) => {
    const control = target instanceof Element ? target.closest(INTERACTIVE) : null;
    if (control === last) return;
    last = control;
    if (!control || control.matches(":disabled, [aria-disabled=true]")) return;
    // In-match skill buttons and perk cards have their own gameplay cues.
    if (control.matches("[data-skill], [data-perk], [data-use-perk]")) return;
    if (options.active && !options.active()) return;
    const now = performance.now();
    if (now - lastAt < MIN_GAP_MS) return;
    lastAt = now;
    options.hover();
  };
  const over = (event: Event) => cue(event.target);
  const focus = (event: Event) => {
    if (event.target instanceof Element && event.target.matches(":focus-visible")) cue(event.target);
  };
  const leave = () => {
    last = null;
  };
  root.addEventListener("pointerover", over);
  root.addEventListener("focusin", focus);
  root.addEventListener("pointerleave", leave);
  return () => {
    root.removeEventListener("pointerover", over);
    root.removeEventListener("focusin", focus);
    root.removeEventListener("pointerleave", leave);
  };
}
