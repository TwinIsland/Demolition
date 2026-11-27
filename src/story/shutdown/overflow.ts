import type { Stage } from "../stage";

/** Characters per second: he says his name faster than the box can take it. */
const SPEED = 30;

/**
 * A line that does not fit. It is typed on one row that never wraps, so it runs out of the text
 * box and off the edge of the picture; the box gives up before he does. `finished` resolves once
 * the player has pressed on, false if the story was closed first.
 */
export function sayTooMuch(stage: Stage, name: string, fits: string, spill: string, painted = false) {
  const box = document.createElement("div");
  // Over the panel that has an empty text box painted into it, the words go into that box.
  box.className = painted ? "shutdown-overflow painted" : "shutdown-overflow";
  box.innerHTML = `<div class="story-name"></div><p></p>`;
  box.firstElementChild!.textContent = name;
  const text = box.querySelector("p")!;
  stage.root.querySelector(".story-dialogue")!.before(box);
  const full = fits + spill;
  let shown = 0,
    timer = 0,
    settle: (alive: boolean) => void = () => {};
  const finished = new Promise<boolean>((resolve) => (settle = resolve));
  timer = window.setInterval(() => {
    shown++;
    // Once the row is full the titles are made up on the spot, and they do not stop.
    const tail = shown <= full.length ? "" : "·真".repeat(Math.floor((shown - full.length) / 2));
    text.textContent = full.slice(0, shown) + tail;
    if (shown % 3 === 1) stage.host.typeTick();
    if (shown === fits.length + 4) box.classList.add("spilling");
    if (shown > full.length + 60) clearInterval(timer);
  }, 1000 / SPEED);
  const proceed = () => {
    // Not before enough has been typed that the joke has landed.
    if (shown <= fits.length + 8) return;
    clearInterval(timer);
    box.remove();
    settle(true);
  };
  box.addEventListener("click", proceed);
  return {
    finished,
    paused: false,
    /** The action key: on with the story. */
    act: proceed,
    dispose() {
      clearInterval(timer);
      box.remove();
      settle(false);
    },
  };
}
