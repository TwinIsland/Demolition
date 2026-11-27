import { MUSIC_BOX_TRACKS, type MusicPlayer } from "../audio/music-player";
import { t } from "../i18n";
import { mountCreditsSpectrum } from "./credits-spectrum";
import { query } from "./dom";
import { icon } from "./icons";

const clock = (seconds: number) => {
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
};

export function musicBoxMarkup() {
  return `<header class="music-box-head"><div><small>STORY SOUNDTRACK</small><h2>${t("音乐盒")}</h2></div>
    <button type="button" id="music-box-close" aria-label="${t("关闭音乐盒")}">${icon("close")}</button></header>
    <div class="music-box-display"><span class="music-box-state" aria-live="polite"></span>
      <h3 class="music-box-title"></h3><p class="music-box-artist"></p>
      <canvas class="music-box-spectrum" aria-hidden="true"></canvas></div>
    <div class="music-box-progress"><input type="range" min="0" max="1" value="0" step="0.1" aria-label="${t("播放进度")}">
      <div><time class="music-box-position">0:00</time><time class="music-box-duration">0:00</time></div></div>
    <div class="music-box-controls">
      <button type="button" data-music-step="-1" aria-label="${t("上一首")}">${icon("previous")}</button>
      <button type="button" class="music-box-play" aria-label="${t("暂停音乐")}"></button>
      <button type="button" data-music-step="1" aria-label="${t("下一首")}">${icon("next")}</button>
      <label class="music-box-volume">${icon("volume")}
        <input type="range" min="0" max="1" step="0.01" aria-label="${t("音乐音量")}"></label>
    </div>
    <ol class="music-box-tracks" aria-label="${t("故事原声")}">${MUSIC_BOX_TRACKS.map(
      (track, index) =>
        `<li><button type="button" data-music-track="${index}"><span>${String(index + 1).padStart(2, "0")}</span><span><b>${track.title}</b><small>${track.artist}</small></span>${icon("play")}</button></li>`,
    ).join("")}</ol>
    <p class="music-box-note">${t("关闭后继续剧情音乐")}</p>`;
}

export function mountMusicBox(root: HTMLElement, player: MusicPlayer, setVolume: (value: number) => void) {
  const progress = query<HTMLInputElement>(root, ".music-box-progress input");
  const volume = query<HTMLInputElement>(root, ".music-box-volume input");
  const play = query<HTMLButtonElement>(root, ".music-box-play");
  const position = query(root, ".music-box-position");
  const duration = query(root, ".music-box-duration");
  const title = query(root, ".music-box-title");
  const artist = query(root, ".music-box-artist");
  const state = query(root, ".music-box-state");
  const tracks = root.querySelectorAll<HTMLButtonElement>("[data-music-track]");
  const listeners = new AbortController();
  const { signal } = listeners;
  const stopSpectrum = mountCreditsSpectrum(
    query<HTMLCanvasElement>(root, "canvas"),
    player.spectrum,
    () => true,
  );
  let frame = 0;
  let scrubbing = false;
  let previousState = "";
  let previousTrack = -1;
  const refresh = () => {
    frame = requestAnimationFrame(refresh);
    if (previousTrack !== player.index) {
      previousTrack = player.index;
      title.textContent = player.track.title;
      artist.textContent = player.track.artist;
      for (const button of tracks)
        button.setAttribute("aria-current", String(Number(button.dataset.musicTrack) === player.index));
    }
    const status = player.error
      ? t("无法播放，点击重试或切换歌曲")
      : player.loading
        ? t("加载中…")
        : player.playing
          ? t("正在播放")
          : t("已暂停");
    const viewState = `${player.playing}/${status}/${player.muted}`;
    if (viewState !== previousState) {
      previousState = viewState;
      state.textContent = player.muted ? `${status} · ${t("已静音")}` : status;
      play.innerHTML = icon(player.playing ? "pause" : "play");
      play.ariaLabel = player.playing ? t("暂停音乐") : t("播放音乐");
      play.setAttribute("aria-pressed", String(player.playing));
    }
    progress.max = String(player.duration || 1);
    progress.disabled = player.loading || !player.duration;
    if (!scrubbing) progress.value = String(player.position);
    position.textContent = clock(Number(progress.value));
    duration.textContent = clock(player.duration);
    volume.value = String(player.volume);
  };
  root.addEventListener(
    "click",
    (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>("button");
      if (!button) return;
      if (button.dataset.musicTrack !== undefined) player.select(Number(button.dataset.musicTrack));
      else if (button.dataset.musicStep) player.select(player.index + Number(button.dataset.musicStep));
      else if (button === play) player.toggle();
    },
    { signal },
  );
  progress.addEventListener(
    "input",
    () => {
      scrubbing = true;
      position.textContent = clock(Number(progress.value));
    },
    { signal },
  );
  progress.addEventListener(
    "change",
    () => {
      player.seek(Number(progress.value));
      scrubbing = false;
    },
    { signal },
  );
  progress.addEventListener(
    "pointercancel",
    () => {
      scrubbing = false;
    },
    { signal },
  );
  volume.addEventListener("input", () => setVolume(Number(volume.value)), { signal });
  refresh();
  return () => {
    cancelAnimationFrame(frame);
    stopSpectrum();
    listeners.abort();
    player.dispose();
  };
}
