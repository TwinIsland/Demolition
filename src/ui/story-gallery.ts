import { FILMS, unlockedFilms } from "../story/films";
import { ILLUSTRATIONS, unlockedIllustrations } from "../story/gallery";
import { t } from "../i18n";
import { query } from "./dom";
import { icon } from "./icons";

/** The two shelves of the collection. */
export type GalleryTab = "art" | "films";

const number = (index: number) => String(index + 1).padStart(2, "0");

export function galleryMarkup(tab: GalleryTab = "art") {
  const art = unlockedIllustrations();
  const films = unlockedFilms();
  const artCount = ILLUSTRATIONS.filter((entry) => entry.url && art.has(entry.id)).length;
  const filmCount = FILMS.filter((film) => films.has(film.id)).length;
  const shelf = (id: GalleryTab, label: string, count: number, total: number) =>
    `<button type="button" role="tab" data-gallery-tab="${id}" aria-selected="${id === tab}">${t(label)}<small>${count} / ${total}</small></button>`;
  return `<header class="gallery-head"><div><small>STORY COLLECTION</small><h2>${t("收藏")}</h2></div>
      <button type="button" id="gallery-close" aria-label="${t("关闭收藏")}">${icon("close")}</button></header>
    <div class="gallery-tabs" role="tablist">${shelf("art", "插画", artCount, ILLUSTRATIONS.length)}${shelf("films", "动画", filmCount, FILMS.length)}</div>
    <section data-gallery-shelf="art" ${tab === "art" ? "" : "hidden"}>
    <figure class="gallery-preview"><img alt="" hidden><div class="gallery-empty">${icon("lock")}<span>${t("游玩故事，解锁插画")}</span></div>
      <figcaption></figcaption></figure>
    <div class="gallery-grid" aria-label="${t("故事插画")}">${ILLUSTRATIONS.map((entry, index) => {
      const visible = entry.url && art.has(entry.id);
      return `<button type="button" class="gallery-tile" data-illustration="${entry.id}" ${visible ? "" : "disabled"}>
        ${visible ? `<img src="${entry.url}" alt="${t(entry.title)}" loading="lazy">` : `<span class="gallery-locked">${icon("lock")}</span>`}
        <span class="gallery-caption"><small>${number(index)}</small><span>${t(visible ? entry.title : "未解锁")}</span></span></button>`;
    }).join("")}</div></section>
    <section data-gallery-shelf="films" ${tab === "films" ? "" : "hidden"}>
    <p class="gallery-note">${t("看过的过场动画可以在这里重播，带原本的音乐和对白。按 ESC 暂停或退出。")}</p>
    <div class="gallery-grid" aria-label="${t("故事动画")}">${FILMS.map((film, index) => {
      const visible = films.has(film.id);
      return `<button type="button" class="gallery-tile gallery-film" data-film="${film.id}" ${visible ? "" : "disabled"}>
        ${
          visible
            ? `<span class="gallery-reel">${film.cover ? `<img src="${film.cover}" alt="" loading="lazy">` : ""}<i>${icon("play")}</i></span>`
            : `<span class="gallery-locked">${icon("lock")}</span>`
        }
        <span class="gallery-caption"><small>${number(index)}</small><span>${t(visible ? film.title : "未解锁")}</span><small class="gallery-act">${t("第 {0} 幕", film.act)}</small></span></button>`;
    }).join("")}</div></section>`;
}

/** `play` is asked for a film when its tile is clicked. */
export function mountGallery(root: HTMLElement, play: (film: string) => void) {
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
  const open = (tab: string) => {
    for (const button of root.querySelectorAll<HTMLElement>("[data-gallery-tab]"))
      button.setAttribute("aria-selected", String(button.dataset.galleryTab === tab));
    for (const shelf of root.querySelectorAll<HTMLElement>("[data-gallery-shelf]"))
      shelf.hidden = shelf.dataset.galleryShelf !== tab;
  };
  root.addEventListener(
    "click",
    (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>("button");
      if (!button || button.disabled) return;
      const { illustration, film, galleryTab } = button.dataset;
      if (illustration) select(illustration);
      else if (galleryTab) open(galleryTab);
      else if (film) play(film);
    },
    { signal: listeners.signal },
  );
  const first = ILLUSTRATIONS.find((art) => art.url && unlocked.has(art.id));
  if (first) select(first.id);
  return () => listeners.abort();
}
