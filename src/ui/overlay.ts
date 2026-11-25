import { t } from "../i18n";

/** The single modal layer. Showing a dialog replaces whatever was open. */
export class Overlay {
  constructor(readonly root: HTMLElement) {}

  /** The open dialog with the given class, if that is what is showing. */
  dialog(className: string): HTMLElement | null {
    return this.root.querySelector<HTMLElement>(`.${className}`);
  }

  /** Opens a dialog and returns it. Focus goes to `focus`, by default the first button. */
  show(html: string, className = "", focus = "button"): HTMLElement {
    this.root.innerHTML = `<section class="modal ${className}" role="dialog" aria-modal="true" aria-label="${t("游戏菜单")}">${html}</section>`;
    this.root.hidden = false;
    queueMicrotask(() => this.root.querySelector<HTMLElement>(focus)?.focus());
    return this.root.firstElementChild as HTMLElement;
  }

  hide() {
    this.root.hidden = true;
    this.root.innerHTML = "";
  }
}
