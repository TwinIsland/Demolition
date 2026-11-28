import { MAPS } from "../core/maps";
import { field, language } from "../i18n";
import { ASSET_GROUPS, STAFF, type AssetCredit, type Bilingual, type StaffCredit } from "./credits-data";
import { query } from "./dom";
import { mountCreditsSpectrum, type SpectrumReader } from "./credits-spectrum";

/** Roll speed in CSS pixels per second, and the multiplier while the pointer is held down. */
const ROLL_SPEED = 62;
const FAST_FORWARD = 5;

const say = (copy: Bilingual) => copy[language === "zh" ? 0 : 1];

/** Label of the lobby button that opens the roll. */
export const creditsLabel = () => say(["致谢", "Credits"]);

const staffMarkup = ({ role, names }: StaffCredit) =>
  `<div class="credits-role"><dt>${say(role)}</dt>${names.map((name) => `<dd>${name}</dd>`).join("")}</div>`;

function useOf(entry: AssetCredit) {
  if (entry.use) return say(entry.use);
  const map = entry.map && MAPS.find(({ id }) => id === entry.map);
  return map ? field(map, "name") : "";
}

function assetMarkup(entry: AssetCredit) {
  const use = useOf(entry);
  return `<div class="credits-asset"><dt>${entry.title}${use ? `<small>${use}</small>` : ""}</dt><dd>${entry.author}${entry.license ? `<small>${entry.license}</small>` : ""}</dd></div>`;
}

/** Staff roll followed by the third-party asset credits, as one tall strip that scrolls. */
export function creditsMarkup() {
  return `<div class="credits-viewport">
    <div class="credits-track">
      <header class="credits-head"><img src="./assets/menu/insignia.png" alt=""><p class="credits-title">${say(["爆破前线", "DEMOLITION"])}</p><p class="credits-kicker">${say(["制作名单", "Staff"])}</p></header>
      <dl class="credits-staff">${STAFF.map(staffMarkup).join("")}</dl>
      <p class="credits-divider">${say(["素材与开源致谢", "Assets & Open Source"])}</p>
      ${ASSET_GROUPS.map((group) => `<section class="credits-group"><h3>${say(group.title)}</h3><dl>${group.entries.map(assetMarkup).join("")}</dl></section>`).join("")}
      <p class="credits-note">${say([
        "其余模型、音效、着色器与像素皮肤均为本项目原创。Minecraft 是 Mojang 的商标，本项目与其无关联。",
        "All other models, sounds, shaders and pixel skins are original to this project. Minecraft is a trademark of Mojang; this project is not affiliated.",
      ])}</p>
      <footer class="credits-end"><p class="credits-thanks">${say(["感谢游玩", "Thanks for playing"])}</p><p>TwinIsland</p>
      </footer>
    </div>
  </div>
  <canvas class="credits-spectrum" aria-hidden="true"></canvas>
  <div class="credits-bar"><span>${say(["按住画面加速", "Hold to fast-forward"])}</span><button type="button" id="credits-close">${say(["返回", "Back"])} <kbd>ESC</kbd></button></div>`;
}

/**
 * Starts the roll in an opened credits dialog. It stops with the closing card centred. With reduced
 * motion the strip is a plain scrollable page instead.
 */
export function mountCredits(dialog: HTMLElement, readSpectrum: SpectrumReader) {
  const stopSpectrum = mountCreditsSpectrum(
    query<HTMLCanvasElement>(dialog, ".credits-spectrum"),
    readSpectrum,
  );
  const viewport = query(dialog, ".credits-viewport");
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    viewport.classList.add("credits-static");
    const revealSpectrum = () => {
      dialog.classList.toggle(
        "credits-finished",
        viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 2,
      );
    };
    viewport.addEventListener("scroll", revealSpectrum);
    revealSpectrum();
    return () => {
      viewport.removeEventListener("scroll", revealSpectrum);
      stopSpectrum();
    };
  }
  const track = query(dialog, ".credits-track");
  const end = query(dialog, ".credits-end");
  const from = viewport.clientHeight;
  const to = viewport.clientHeight / 2 - (end.offsetTop + end.offsetHeight / 2);
  const roll = track.animate([{ transform: `translateY(${from}px)` }, { transform: `translateY(${to}px)` }], {
    duration: ((from - to) / ROLL_SPEED) * 1000,
    easing: "linear",
    fill: "forwards",
  });
  roll.onfinish = () => dialog.classList.add("credits-finished");
  // The listeners live on the dialog, so they go away with it when the overlay closes.
  const setRate = (rate: number) => () => roll.updatePlaybackRate(rate);
  viewport.addEventListener("pointerdown", (event) => {
    if (!(event.target as Element).closest("a")) setRate(FAST_FORWARD)();
  });
  for (const type of ["pointerup", "pointercancel", "pointerleave"])
    viewport.addEventListener(type, setRate(1));
  return () => {
    stopSpectrum();
    roll.cancel();
  };
}
