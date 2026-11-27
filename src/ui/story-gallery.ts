import { ILLUSTRATIONS, unlockedIllustrations } from "../story/gallery";
import { t } from "../i18n";
import { query } from "./dom";
import { icon } from "./icons";

export function galleryMarkup() {
  const unlocked = unlockedIllustrations();
  const count = ILLUSTRATIONS.filter((art) => art.url && unlocked.has(art.id)).length;
  return `<header class="gallery-head"><div><small>STORY ILLUSTRATIONS · ${count} / ${ILLUSTRATIONS.length}</small><h2>${t("收藏")}</h2></div>
      <button type="button" id="gallery-close" aria-label="${t("关闭收藏")}">${icon("close")}</button></header>
    <figure class="gallery-preview"><img alt="" hidden><div class="gallery-empty">${icon("lock")}<span>${t("游玩故事，解锁插画")}</span></div>
      <figcaption></figcaption></figure>
    <div class="gallery-grid" aria-label="${t("故事插画")}">${ILLUSTRATIONS.map((art, index) => {
      const visible = art.url && unlocked.has(art.id);
      return `<button type="button" class="gallery-tile" data-illustration="${art.id}" ${visible ? "" : "disabled"}>
        ${visible ? `<img src="${art.url}" alt="${t(art.title)}" loading="lazy">` : `<span class="gallery-locked">${icon("lock")}</span>`}
        <span class="gallery-caption"><small>${String(index + 1).padStart(2, "0")}</small><span>${t(visible ? art.title : "未解锁")}</span></span></button>`;
    }).join("")}</div>`;
}

export function mountGallery(root: HTMLElement) {
  const unlocked = unlockedIllustrations();
  const image = query<HTMLImageElement>(root, ".gallery-preview img");
  const caption = query(root, "figcaption");
  const empty = query<HTMLElement>(root, ".gallery-empty");
  const buttons = root.querySelectorAll<HTMLButtonElement>("[data-illustration]");
  const listeners = new AbortController();
  const select = (id: string) => {
    const art = ILLUSTRATIONS.find((entry) => entry.id === id);
    if (!art?.url || !unlocked.has(id)) return;
    image.src = art.url;
    image.alt = t(art.title);
    image.hidden = false;
    empty.hidden = true;
    caption.textContent = t(art.title);
    for (const button of buttons)
      button.setAttribute("aria-pressed", String(button.dataset.illustration === id));
  };
  root.addEventListener(
    "click",
    (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>("[data-illustration]");
      if (button?.dataset.illustration && !button.disabled) select(button.dataset.illustration);
    },
    { signal: listeners.signal },
  );
  const first = ILLUSTRATIONS.find((art) => art.url && unlocked.has(art.id));
  if (first) select(first.id);
  return () => listeners.abort();
}
