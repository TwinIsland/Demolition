import { t } from "../i18n";
import { rise } from "./lobby-motion";

const markup = () => `
  <div class="confirm-box">
    <small class="detail-kicker">${t("故事模式")}</small>
    <h2 id="story-exit-title">${t("退出到主菜单？")}</h2>
    <p class="confirm-text">${t("进度保存在上一个存档点，下次会从那里继续。")}</p>
    <div class="confirm-actions">
      <button type="button" class="menu-row" data-exit="stay"><span class="row-label">${t("继续游戏")}</span><kbd>ESC</kbd></button>
      <button type="button" class="menu-row confirm-danger" data-exit="leave"><span class="row-label">${t("退出")}</span></button>
    </div>
  </div>`;

/**
 * "Leave the story?" dialog, laid over the story screen. Escape asks instead of leaving at once;
 * the story is held still while the question is up.
 */
export class StoryExitPrompt {
  private readonly dialog = document.createElement("div");

  constructor(
    screen: HTMLElement,
    private readonly host: { pause(on: boolean): void; leave(): void; click(): void },
  ) {
    this.dialog.className = "story-confirm story-exit";
    this.dialog.setAttribute("role", "alertdialog");
    this.dialog.setAttribute("aria-modal", "true");
    this.dialog.setAttribute("aria-labelledby", "story-exit-title");
    this.dialog.hidden = true;
    this.dialog.innerHTML = markup();
    this.dialog.addEventListener("click", (event) => {
      const choice = (event.target as HTMLElement).closest<HTMLElement>("[data-exit]")?.dataset.exit;
      if (choice === "leave") this.host.leave();
      else if (choice === "stay") this.toggle();
    });
    // Left and Right move between the two answers.
    this.dialog.addEventListener("keydown", (event) => {
      if (!event.code.startsWith("Arrow")) return;
      event.preventDefault();
      const buttons = [...this.dialog.querySelectorAll<HTMLElement>("button")];
      buttons[(buttons.indexOf(document.activeElement as HTMLElement) + 1) % buttons.length].focus();
    });
    screen.append(this.dialog);
  }

  /** Escape: asks, or takes the question back when it is already up. */
  toggle() {
    const open = this.dialog.hidden;
    this.dialog.hidden = !open;
    this.host.pause(open);
    this.host.click();
    if (!open) return;
    rise([this.dialog.querySelector<HTMLElement>(".confirm-box")!], 0, 18);
    this.dialog.querySelector<HTMLElement>('[data-exit="stay"]')!.focus({ preventScroll: true });
  }
}
