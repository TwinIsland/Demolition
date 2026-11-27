/**
 * After-action screen: the full-screen report shown when the match ends or the viewer is
 * eliminated. This file builds the markup and the figures behind it; match-result-motion.ts
 * plays the reveal.
 */
import { MAPS } from "../core/maps";
import { MATCH_MODES, DEFAULT_MODE } from "../core/match-modes";
import { emptyMatchStats, type GameSnapshot, type MatchStats, type Player } from "../core/types";
import { field, t } from "../i18n";
import { icon } from "./icons";

export type ResultKind = "victory" | "defeat" | "draw" | "eliminated";

/**
 * Optional full-screen key art: `result-art/<victory|defeat|draw>.<webp|jpg|png>`. Found at build
 * time, so dropping a file in is all it takes; without one the screen uses the banner strip from
 * the UI skin. Defeat art also backs the eliminated screen.
 */
const ART = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>("./result-art/*.{webp,jpg,png}", {
      eager: true,
      query: "?url",
      import: "default",
    }),
  ).map(([path, url]) => [path.replace(/^.*\/|\.\w+$/g, ""), url]),
);
/**
 * Optional painted chrome: `result-art/frames/<panel|row|card|plate>.<webp|png>` with transparency.
 * `panel` (operator panel, 9-slice, 128 px corners of 1024), `row` (scoreboard row, 160 px end caps
 * of 1600 x 160), `card` (highlight card, 9-slice, 64 px corners of 768 x 256) and `plate` (the band
 * behind the headline, stretched). Each one replaces the drawn version of that element only.
 */
const FRAMES = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>("./result-art/frames/*.{webp,png}", {
      eager: true,
      query: "?url",
      import: "default",
    }),
  ).map(([path, url]) => [path.replace(/^.*\/|\.\w+$/g, ""), url]),
);
/** Every result backdrop and frame, for the loading screen. */
export const resultArt = () => [...Object.values(ART), ...Object.values(FRAMES)];

/** Hands the painted frames to the stylesheet: `--rs-frame-<name>` and `data-frames`. */
export function applyResultFrames(screen: HTMLElement) {
  for (const [name, url] of Object.entries(FRAMES))
    screen.style.setProperty(`--rs-frame-${name}`, `url("${url}")`);
  screen.dataset.frames = Object.keys(FRAMES).join(" ");
}

export function resultKind(snapshot: Readonly<GameSnapshot>, viewer: Player): ResultKind {
  if (snapshot.phase !== "finished") return "eliminated";
  if (snapshot.winnerId === viewer.id) return "victory";
  return snapshot.winnerId ? "defeat" : "draw";
}

const statsOf = (p: Player): MatchStats => p.stats ?? emptyMatchStats();

/** Best first: the winner, then survivors, then by score. */
export function standings(snapshot: Readonly<GameSnapshot>): Player[] {
  const rank = (p: Player) => (p.id === snapshot.winnerId ? 2 : p.alive ? 1 : 0);
  return [...snapshot.players].sort((a, b) => rank(b) - rank(a) || b.score - a.score);
}

/** 1 for the best standing. */
export function placement(snapshot: Readonly<GameSnapshot>, viewer: Player): number {
  return standings(snapshot).findIndex((p) => p.id === viewer.id) + 1;
}

/** A medal for leading the match in one figure. Nobody holds it while the figure is zero. */
interface Accolade {
  id: string;
  glyph: string;
  name: string;
  /** Caption of the figure, with the value as `{0}`. */
  caption: string;
  value: (p: Player) => number;
}
const ACCOLADES: readonly Accolade[] = [
  { id: "mvp", glyph: "crown", name: "全场最佳", caption: "{0} 积分", value: (p) => p.score },
  { id: "kills", glyph: "target", name: "头号杀手", caption: "{0} 次淘汰", value: (p) => p.kills },
  {
    id: "damage",
    glyph: "flame",
    name: "火力压制",
    caption: "{0} 点伤害",
    value: (p) => statsOf(p).damageDealt,
  },
  {
    id: "cover",
    glyph: "crate",
    name: "拆迁专家",
    caption: "{0} 个掩体",
    value: (p) => statsOf(p).coverDestroyed,
  },
  {
    id: "zombies",
    glyph: "dna",
    name: "清道夫",
    caption: "{0} 只僵尸",
    value: (p) => statsOf(p).zombieKills,
  },
  {
    id: "bombs",
    glyph: "bomb",
    name: "爆破狂人",
    caption: "{0} 枚炸药",
    value: (p) => statsOf(p).bombsPlaced,
  },
];
const HIGHLIGHTS = 4;

interface Awarded {
  accolade: Accolade;
  holder: Player;
  value: number;
}
/** Ties go to the better standing. */
function awards(ranked: readonly Player[]): Awarded[] {
  return ACCOLADES.flatMap((accolade) => {
    let holder: Player | undefined;
    let best = 0;
    for (const p of ranked) {
      const value = Math.round(accolade.value(p));
      if (value > best) [holder, best] = [p, value];
    }
    return holder ? [{ accolade, holder, value: best }] : [];
  });
}

const escapeHtml = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
const clock = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
/** A figure the reveal counts up to. */
const count = (value: number) => `<b data-count="${Math.round(value)}">${Math.round(value)}</b>`;
const head = (p: Player) =>
  `<span class="avatar rs-head" data-player="${p.id}" data-skin="${p.skin ?? ""}" style="--player-color:${p.color}"><i></i><i></i></span>`;
const medal = ({ accolade }: Awarded) =>
  `<i class="rs-medal" data-medal="${accolade.id}" title="${t(accolade.name)}">${icon(accolade.glyph)}</i>`;

const HEADLINES: Record<ResultKind, { kicker: string; headline: string; ghost: string }> = {
  victory: { kicker: "任务完成", headline: "胜利", ghost: "VICTORY" },
  defeat: { kicker: "任务失败", headline: "战败", ghost: "DEFEAT" },
  draw: { kicker: "无人生还", headline: "平局", ghost: "DRAW" },
  eliminated: { kicker: "行动中止", headline: "已淘汰", ghost: "ELIMINATED" },
};

function bannerMarkup(snapshot: Readonly<GameSnapshot>, kind: ResultKind) {
  const { kicker, headline, ghost } = HEADLINES[kind];
  const winner = snapshot.players.find((p) => p.id === snapshot.winnerId);
  const detail =
    kind === "victory"
      ? t("你是最后的幸存者")
      : kind === "defeat"
        ? t("{0} 赢得对局", escapeHtml(winner?.name ?? ""))
        : kind === "draw"
          ? t("没有人撑到最后")
          : t("对局仍在继续");
  const map = MAPS.find((m) => m.id === snapshot.mapId);
  const meta = [
    map ? field(map, "name") : snapshot.mapName,
    t(MATCH_MODES[snapshot.mode ?? DEFAULT_MODE].name),
    clock(snapshot.time),
  ];
  return `<header class="rs-banner">
      <i class="rs-ghost" aria-hidden="true"><span>${ghost}</span></i>
      <i class="rs-band" aria-hidden="true"></i>
      <small class="rs-kicker">${t(kicker)}</small>
      <h2 data-text="${t(headline)}">${t(headline)}</h2>
      <p class="rs-sub"><span>${detail}</span>${meta.map((part) => `<span>${escapeHtml(part)}</span>`).join("")}</p>
    </header>`;
}

function operatorMarkup(snapshot: Readonly<GameSnapshot>, viewer: Player) {
  const stats = statsOf(viewer);
  const genes = Object.values(viewer.mutations ?? {}).reduce((sum, n) => sum + n, 0);
  const figures: [string, number][] = [
    ["淘汰数", viewer.kills],
    ["造成伤害", stats.damageDealt],
    ["承受伤害", stats.damageTaken],
    ["摧毁掩体", stats.coverDestroyed],
    ["击倒僵尸", stats.zombieKills],
    ["炸药数", stats.bombsPlaced],
  ];
  const fraction = viewer.nextLevel > 0 ? Math.min(1, viewer.xp / viewer.nextLevel) : 0;
  return `<aside class="rs-operator">
      <div class="rs-ident">
        <div class="outcome-badge-slot"></div>
        <div class="rs-who">
          <div class="rs-place"><small>${t("排名")}</small><strong>#${placement(snapshot, viewer)}</strong><em>/ ${snapshot.players.length}</em></div>
          <div class="rs-name">${head(viewer)}<span>${escapeHtml(viewer.name)}</span></div>
        </div>
      </div>
      <div class="rs-xp" data-level="${viewer.level}" data-fraction="${fraction.toFixed(3)}">
        <div class="rs-xp-head">
          <span class="rs-xp-level">LV. <b>${viewer.level}</b></span>
          <span class="rs-xp-gain">+${count(viewer.score)} XP</span>
        </div>
        <div class="rs-xp-bar"><i class="rs-xp-fill" style="--fraction:${fraction.toFixed(3)}"></i></div>
        <div class="rs-xp-foot">
          <span>${Math.round(viewer.xp)} / ${viewer.nextLevel}</span>
          <span>${t("强化")} ×${viewer.perks.length} · ${t("基因")} ×${genes}</span>
        </div>
      </div>
      <dl class="rs-figures">${figures
        .map(([label, value]) => `<div><dt>${t(label)}</dt><dd>${count(value)}</dd></div>`)
        .join("")}</dl>
    </aside>`;
}

function boardMarkup(
  snapshot: Readonly<GameSnapshot>,
  viewer: Player,
  ranked: readonly Player[],
  awarded: readonly Awarded[],
) {
  const row = (p: Player, index: number) => {
    const stats = statsOf(p);
    const state = p.id === snapshot.winnerId ? "winner" : p.alive ? "alive" : "out";
    return `<li class="rs-row" data-state="${state}"${p.id === viewer.id ? " data-self" : ""} style="--player-color:${p.color}">
        <span class="rs-rank">${index + 1}</span>
        <span class="rs-player">${head(p)}<span class="rs-player-name">${escapeHtml(p.name)}${
          p.id === viewer.id ? `<em>${t("你")}</em>` : ""
        }</span><span class="rs-medals">${awarded
          .filter((award) => award.holder.id === p.id)
          .map(medal)
          .join("")}</span></span>
        <span>${p.level}</span>
        <span>${count(p.kills)}</span>
        <span>${count(stats.damageDealt)}</span>
        <span class="rs-time">${p.alive ? t("存活") : clock(stats.diedAt ?? snapshot.time)}</span>
        <span class="rs-score">${count(p.score)}</span>
      </li>`;
  };
  return `<section class="rs-board">
      <div class="rs-board-head">
        <span>#</span><span>${t("干员")}</span><span>${t("等级")}</span><span>${t("淘汰数")}</span><span>${t("伤害")}</span><span>${t("存活至")}</span><span>${t("积分")}</span>
      </div>
      <ol class="rs-rows">${ranked.map(row).join("")}</ol>
    </section>`;
}

function highlightsMarkup(awarded: readonly Awarded[]) {
  if (!awarded.length) return `<section class="rs-highlights" hidden></section>`;
  return `<section class="rs-highlights" aria-label="${t("对局高光")}">
      <h3>${t("对局高光")}</h3>
      <div class="rs-cards">${awarded
        .slice(0, HIGHLIGHTS)
        .map(
          (
            award,
          ) => `<article class="rs-card" data-medal="${award.accolade.id}" style="--player-color:${award.holder.color}">
            ${medal(award)}
            <div class="rs-card-text"><small>${t(award.accolade.name)}</small><strong>${escapeHtml(award.holder.name)}</strong><span>${t(award.accolade.caption, award.value)}</span></div>
            ${head(award.holder)}
          </article>`,
        )
        .join("")}</div>
    </section>`;
}

function actionsMarkup(kind: ResultKind) {
  const again = `<button class="rs-btn${kind === "eliminated" ? "" : " rs-btn-primary"}" id="restart">${icon("refresh")}<span>${t("再来一局")}</span></button>`;
  const home = `<button class="rs-btn" id="home"><span>${t("返回首页")}</span></button>`;
  const spectate =
    kind === "eliminated"
      ? `<button class="rs-btn rs-btn-primary" id="resume">${icon("play")}<span>${t("观战剩余对局")}</span></button>`
      : "";
  return `<footer class="rs-actions">${home}${again}${spectate}</footer>`;
}

/** Markup of the whole screen; `kind` also names its colour scheme (`outcome-<kind>`). */
export function resultMarkup(snapshot: Readonly<GameSnapshot>, viewer: Player, kind: ResultKind) {
  const ranked = standings(snapshot);
  const awarded = awards(ranked);
  const art = ART[kind === "eliminated" ? "defeat" : kind];
  return `<div class="rs-backdrop" aria-hidden="true"${art ? ` style="--rs-art:url('${art}')" data-art` : ""}><i class="rs-flash"></i></div>
    ${bannerMarkup(snapshot, kind)}
    <div class="rs-body">
      ${operatorMarkup(snapshot, viewer)}
      ${boardMarkup(snapshot, viewer, ranked, awarded)}
    </div>
    ${highlightsMarkup(awarded)}
    ${actionsMarkup(kind)}`;
}
