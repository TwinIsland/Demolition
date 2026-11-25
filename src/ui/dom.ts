/** Looks up an element the markup is known to contain; a miss is a programming error. */
export function query<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing UI element: ${selector}`);
  return element;
}

/** Writes text only when it changed, so an unchanged HUD frame leaves the DOM alone. */
export function setText(element: Element, text: string) {
  if (element.textContent !== text) element.textContent = text;
}

/** Replaces the content only when the markup changed. Returns whether it repainted. */
export class HtmlSlot {
  private last = "";

  constructor(private readonly element: Element) {}

  render(html: string): boolean {
    if (html === this.last) return false;
    this.last = html;
    this.element.innerHTML = html;
    return true;
  }
}

/** Restarts a one-shot CSS animation that is driven by a class. */
export function replayAnimation(element: HTMLElement, className: string) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}
