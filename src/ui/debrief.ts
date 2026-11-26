/**
 * After-action report shown on the result and eliminated dialogs. Labels are typed out and each
 * value is decoded from scrambled glyphs. The sequence cannot be skipped: the dialog's buttons
 * stay locked until the last row has landed.
 */
import type { GameSnapshot, Player } from "../core/types";
import { t } from "../i18n";

const CHAR_MS = 16;
const ROW_PAUSE_MS = 90;
/** Frames of scrambling before each character of a value settles. */
const DECODE_FRAMES = 3;
const DECODE_MS = 26;
const GLYPHS = "0123456789#%&$@/<>*+=";

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
    .join("")}</dl><i class="debrief-scan" aria-hidden="true"></i></section>`;
}

/**
 * Plays the report inside `dialog`. `tick` fires for typed and decoded characters (the caller
 * rate-limits the sound). Returns a function that stops the animation and shows the final text;
 * it is for teardown, not for the player.
 */
export function typeDebrief(dialog: HTMLElement, tick: () => void): () => void {
  const report = dialog.querySelector<HTMLElement>(".debrief");
  if (!report || matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  const rows = [...report.querySelectorAll<HTMLElement>("dl > div")].map((row) => {
    const label = row.querySelector<HTMLElement>("dt")!,
      value = row.querySelector<HTMLElement>("dd")!;
    return { row, label, value, labelText: label.textContent ?? "", valueText: value.textContent ?? "" };
  });
  const buttons = [...dialog.querySelectorAll<HTMLButtonElement>("button")];
  for (const { row, label, value } of rows) {
    label.textContent = value.textContent = "";
    row.dataset.pending = "";
  }
  buttons.forEach((button) => (button.disabled = true));
  report.dataset.typing = dialog.dataset.locked = "";

  let timer = 0;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    for (const { row, label, value, labelText, valueText } of rows) {
      label.textContent = labelText;
      value.textContent = valueText;
      delete row.dataset.pending;
      delete row.dataset.active;
    }
    buttons.forEach((button) => (button.disabled = false));
    delete report.dataset.typing;
    delete dialog.dataset.locked;
    if (dialog.isConnected) dialog.querySelector<HTMLElement>("button")?.focus();
  };
  const later = (run: () => void, ms: number) => {
    timer = window.setTimeout(() => (report.isConnected ? run() : finish()), ms);
  };
  const scramble = (text: string, settled: number) =>
    text.slice(0, settled) +
    [...text.slice(settled)]
      .map((c) => (c.trim() ? GLYPHS[Math.floor(Math.random() * GLYPHS.length)] : c))
      .join("");

  const play = (index: number) => {
    const entry = rows[index];
    if (!entry) return finish();
    const { row, label, value, labelText, valueText } = entry;
    delete row.dataset.pending;
    row.dataset.active = "";
    let char = 0;
    const typeLabel = () => {
      label.textContent = labelText.slice(0, ++char);
      if (labelText[char - 1]?.trim()) tick();
      if (char < labelText.length) later(typeLabel, CHAR_MS);
      else later(() => decode(0, 0), CHAR_MS);
    };
    const decode = (settled: number, frame: number) => {
      value.textContent = scramble(valueText, settled);
      if (settled >= valueText.length) {
        delete row.dataset.active;
        // Restart the landing flash even if the same row somehow plays twice.
        row.dataset.landed = "";
        return later(() => play(index + 1), ROW_PAUSE_MS);
      }
      if (frame >= DECODE_FRAMES) {
        tick();
        return later(() => decode(settled + 1, 0), DECODE_MS);
      }
      later(() => decode(settled, frame + 1), DECODE_MS);
    };
    typeLabel();
  };
  later(() => play(0), 900);
  return finish;
}
