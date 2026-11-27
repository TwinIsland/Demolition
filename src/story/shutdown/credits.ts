import { STAFF } from "../../ui/credits-data";
import type { Stage } from "../stage";
import { ENDING_SKINS, type Ending } from "./unlocks";
import { unlockIllustration } from "../gallery";

export interface Roll {
  /** Resolves true when the roll has run out, false if it was disposed first. */
  readonly done: Promise<boolean>;
  /** The action key leaves only after the full credits have finished. */
  act(): void;
  paused: boolean;
  dispose(): void;
}

/** Stage heights per second: the whole roll takes a little over half a minute. */
const SPEED = 0.085;
const HOLD_MS = 4200;

const ENDINGS: Record<Ending, { name: string; last: string }> = {
  home: { name: "结局　回去", last: "「……饭还行。」" },
  stay: { name: "结局　留下", last: "「按 [空格] 放炸药。」" },
};
const CAST: readonly [string, string][] = [
  ["零", "本名小明"],
  ["露露", "引导精灵，运行三百年（三百万 tick）"],
  ["妈妈", "只闻其声"],
  ["张三", "SAMPLE"],
  ["四天王", "蓝屏 · 弹窗 · 杀毒（一共三个）"],
  ["旁白", ""],
];
const MUSIC: readonly [string, string][] = [
  ["电动少女 (8-Bit Remix)", "Chinese Football"],
  ["Share Friendship", "黒魔"],
  ["Clumsy Communication", "黒魔"],
  ["献花の番人", "黒魔"],
  ["电动少女", "Chinese Football"],
];

const escape = (text: string) =>
  text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
const block = (title: string, rows: readonly (readonly [string, string])[]) => `
  <section><h3>${title}</h3>${rows
    .map(([left, right]) => `<p><b>${escape(left)}</b>${right ? `<span>${escape(right)}</span>` : ""}</p>`)
    .join("")}</section>`;

/**
 * The story's own credits: its cast and its songs rolling up over the ending's last picture,
 * then the skin the ending leaves behind. The game's full list of third-party assets stays in
 * the main menu's credits.
 */
export function rollCredits(
  stage: Stage,
  ending: Ending,
  backdrop: string | undefined,
  firstTime: boolean,
): Roll {
  if (backdrop) unlockIllustration(backdrop);
  const layer = document.createElement("div");
  layer.className = "shutdown-credits";
  const reward = ENDING_SKINS[ending];
  layer.innerHTML = `
    ${backdrop ? `<img alt="" src="${backdrop}" />` : ""}
    <div class="credits-shade"></div>
    <div class="credits-column">
      <header><small>${ENDINGS[ending].name}</small><h2>${ENDINGS[ending].last}</h2></header>
      ${block("登场", CAST)}
      ${block("音乐", MUSIC)}
      ${block(
        "制作",
        STAFF.map(({ role, names }) => [role[0], names.join(" · ")] as const),
      )}
      <section><p class="credits-note">第三方素材的完整名单见主菜单「致谢」。</p></section>
      <footer>感谢游玩。</footer>
    </div>
    <div class="credits-reward" hidden>
      <small>${firstTime ? "皮肤解锁" : "皮肤已解锁"}</small>
      <b>「${reward.name}」</b>
      <span>${ending === "home" ? "她说才不是送给你的。" : "他坚持这套衣服叫「漆黑之翼」。"}</span>
      <i><kbd>E</kbd> 返回主菜单</i>
    </div>`;
  stage.root.querySelector(".story-dialogue")!.before(layer);
  const column = layer.querySelector<HTMLElement>(".credits-column")!;
  const card = layer.querySelector<HTMLElement>(".credits-reward")!;

  let offset = 0,
    last = 0,
    frame = 0,
    finished = false,
    rewardTime = 0,
    over = false,
    settle: (finished: boolean) => void = () => {};
  const done = new Promise<boolean>((resolve) => (settle = resolve));
  const roll: Roll = {
    done,
    paused: false,
    act() {
      if (finished && !roll.paused && !over) {
        over = true;
        settle(true);
      }
    },
    dispose() {
      cancelAnimationFrame(frame);
      layer.remove();
      settle(false);
    },
  };
  layer.addEventListener("click", () => roll.act());
  const tick = (now: number) => {
    frame = requestAnimationFrame(tick);
    const dt = roll.paused || !last ? 0 : Math.min(0.1, (now - last) / 1000);
    last = now;
    const height = layer.clientHeight;
    if (!height) return;
    if (!finished) {
      offset += dt * SPEED * height;
      column.style.translate = `0 ${height - offset}px`;
      if (offset < height + column.offsetHeight) return;
      // The column has left the picture: the reward comes up and waits.
      column.hidden = true;
      card.hidden = false;
      stage.host.menu("accept");
      finished = true;
    } else if (!over) {
      rewardTime += dt;
      if (rewardTime > (HOLD_MS * 4) / 1000) {
        over = true;
        settle(true);
      }
    }
  };
  frame = requestAnimationFrame(tick);
  return roll;
}
