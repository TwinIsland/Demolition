import { t } from "../i18n";
import "./device-notice.css";

/** The game needs a keyboard, a mouse and room for the menu; these describe devices without them. */
const TOUCH_ONLY = "(hover: none) and (pointer: coarse)";
const TOO_SMALL = "(max-width: 899px), (max-height: 519px)";
const DISMISSED_KEY = "demolition-device-notice-dismissed";

/**
 * Advises playing on a computer when the page opens on a phone, a tablet or in a very small
 * window. It only advises: the player can continue, and the notice goes away by itself once the
 * window is large enough.
 */
export function mountDeviceNotice() {
  const queries = [matchMedia(TOUCH_ONLY), matchMedia(TOO_SMALL)];
  let dismissed = false;
  try {
    dismissed = sessionStorage.getItem(DISMISSED_KEY) === "1";
  } catch {}

  const notice = document.createElement("section");
  notice.id = "device-notice";
  notice.hidden = true;
  notice.setAttribute("role", "dialog");
  notice.setAttribute("aria-modal", "true");
  document.body.append(notice);

  const sync = () => {
    const show = !dismissed && queries.some((query) => query.matches);
    if (show === !notice.hidden) return;
    if (show) {
      // Built on demand so it uses the language in effect when it appears.
      notice.innerHTML = `<div class="device-notice-card"><img src="./assets/menu/insignia.png" alt=""><h2></h2><p></p><button type="button"></button></div>`;
      notice.querySelector("h2")!.textContent = t("为获得最佳体验，请在电脑上游玩");
      notice.querySelector("p")!.textContent = t("爆破前线需要键盘和鼠标，并且在更大的窗口里效果最好。");
      notice.querySelector("button")!.textContent = t("仍然继续");
    }
    notice.hidden = !show;
  };
  notice.addEventListener("click", (event) => {
    if (!(event.target instanceof HTMLButtonElement)) return;
    dismissed = true;
    try {
      sessionStorage.setItem(DISMISSED_KEY, "1");
    } catch {}
    sync();
  });
  for (const query of queries) query.addEventListener("change", sync);
  sync();
}
