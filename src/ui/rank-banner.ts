import { t } from "../i18n";

/** Shows the level-up banner in the HUD, replacing one that is still playing. */
export function showRankBanner(
  hud: HTMLElement,
  from: number,
  to: number,
  gains: string[] = [],
): HTMLElement {
  hud.querySelector("#rank-up")?.remove();
  const banner = document.createElement("div");
  banner.id = "rank-up";
  banner.setAttribute("role", "status");
  banner.setAttribute("aria-label", t("等级由 {0} 升至 {1}", from, to));
  banner.innerHTML = `<i class="rank-wings" aria-hidden="true"></i><span class="rank-caption">${t("等级提升")}</span>
      <div class="rank-numbers"><small>LV. ${from}</small><i>›</i><strong><em>LV.</em> ${to}</strong></div>${
        gains.length
          ? `<p class="rank-gains">${gains.map((gain) => `<span>${t(gain)}</span>`).join("")}</p>`
          : ""
      }`;
  hud.append(banner);
  banner.addEventListener("animationend", (e) => {
    if (e.target === banner) banner.remove();
  });
  return banner;
}

export function clearRankBanner(hud: HTMLElement) {
  hud.querySelector("#rank-up")?.remove();
}
