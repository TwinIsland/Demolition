/**
 * After-action report shown on the result and eliminated dialogs. Rows are
 * typed out one character at a time; a click or key press finishes instantly.
 */
import type { GameSnapshot, Player } from "../core/types";
import { t } from "../i18n";

const CHAR_MS = 18;
const ROW_PAUSE_MS = 110;

/** 1 for the best standing: survivors outrank the eliminated, then score decides. */
export function placement(snapshot: Readonly<GameSnapshot>, viewer: Player): number {
  if (snapshot.winnerId === viewer.id) return 1;
  const ahead = snapshot.players.filter(
    (p) =>
      p.id !== viewer.id &&
      (p.id === snapshot.winnerId ||
        (p.alive && !viewer.alive) ||
        (p.alive === viewer.alive && p.score > viewer.score)),
  );
  return ahead.length + 1;
}

const clock = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

export function debriefMarkup(snapshot: Readonly<GameSnapshot>, viewer: Player): string {
  const genes = Object.values(viewer.mutations ?? {}).reduce((sum, count) => sum + count, 0);
  const rows: [string, string][] = [
    [t("排名"), `${placement(snapshot, viewer)} / ${snapshot.players.length}`],
    [t("淘汰对手"), String(viewer.kills)],
    [t("总积分"), String(viewer.score)],
    [t("最终等级"), `LV. ${viewer.level}`],
    [t("获得强化"), String(viewer.perks.length)],
    [t("基因改造"), String(genes)],
    [t("攻击力"), String(Math.round(viewer.attack))],
    [t("爆炸范围"), `${viewer.range} ${t("格")}`],
    [viewer.alive ? t("对局时长") : t("存活时间"), clock(snapshot.time)],
  ];
  return `<section class="debrief"><h3>${t("战场结算")}</h3><dl>${rows
    .map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`)
    .join("")}</dl><small class="debrief-skip">${t("点击跳过")}</small></section>`;
}

/**
 * Types the report inside `dialog`. `tick` fires for typed characters (the
 * caller rate-limits the sound). Returns a function that stops the animation.
 */
export function typeDebrief(dialog: HTMLElement, tick: () => void): () => void {
  const report = dialog.querySelector<HTMLElement>(".debrief");
  if (!report || matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  const cells = [...report.querySelectorAll<HTMLElement>("dt, dd")];
  const texts = cells.map((cell) => cell.textContent ?? "");
  const rows = [...report.querySelectorAll<HTMLElement>("dl > div")];
  cells.forEach((cell) => (cell.textContent = ""));
  rows.forEach((row) => (row.dataset.pending = ""));
  report.dataset.typing = "";

  let cell = 0;
  let char = 0;
  let timer = 0;
  const listeners = new AbortController();
  const finish = () => {
    clearTimeout(timer);
    listeners.abort();
    cells.forEach((el, i) => (el.textContent = texts[i]));
    rows.forEach((row) => delete row.dataset.pending);
    delete report.dataset.typing;
  };
  const step = () => {
    if (!report.isConnected) return finish();
    if (cell >= cells.length) return finish();
    const el = cells[cell];
    delete el.parentElement!.dataset.pending;
    char++;
    el.textContent = texts[cell].slice(0, char);
    if (texts[cell][char - 1]?.trim()) tick();
    let delay = CHAR_MS;
    if (char >= texts[cell].length) {
      cell++;
      char = 0;
      // Pause after the value, i.e. at the end of a row.
      if (cell % 2 === 0) delay = ROW_PAUSE_MS;
    }
    timer = window.setTimeout(step, delay);
  };
  dialog.addEventListener("pointerdown", finish, { signal: listeners.signal });
  dialog.addEventListener("keydown", finish, { signal: listeners.signal });
  timer = window.setTimeout(step, 420);
  return finish;
}
