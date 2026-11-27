import { STORY_ART } from "../assets";
import type { ArcadeScene } from "../script";

/**
 * Act 2, "Bubble X": the game on the old computer. Teaches placing a bubble, the cross-shaped
 * blast and breaking crates ("c", or "g" for a gift box, which is a crate in wrapping paper), then a first duel; it ends when the power is cut and the screen
 * pulls the player in.
 */
export const BUBBLE_X: ArcadeScene = {
  kind: "arcade",
  id: "bubble-x",
  layout: [
    "#############",
    "#@..cgc.c...#",
    "#.#c#.#c#.#.#",
    "#.cg...c..c.#",
    "#.#.#c#.#g#.#",
    "#c..c...c..c#",
    "#.#g#.#c#.#.#",
    "#.c..c.cg...#",
    "#.#.#c#.#c#.#",
    "#...c..g...E#",
    "#############",
  ],
  crateGoal: 3,
  goals: { first: "放一个泡泡", crates: "炸开箱子", duel: "击败电脑玩家" },
  lines: {
    start: [
      { who: "system", text: "按 [空格] 放置泡泡。" },
      { who: "zero", mood: "smug", text: "呵，儿戏。看好了——" },
    ],
    chant: [{ who: "zero", mood: "smug", text: "比黑色更黑，比黑暗更暗的漆黑啊，在此托付吾之真红——" }],
    chantFailed: [{ who: "narrator", text: "咏唱需要十一秒。泡泡的引信是三秒。" }],
    warmup: [
      { who: "zero", mood: "flustered", text: "……刚才是热身。" },
      { who: "system", text: "泡泡会向四个方向炸开。放下之后，请离开。" },
    ],
    shoe: [
      { who: "zero", mood: "sincere", text: "箱子里有鞋子。穿上会变快。" },
      { who: "zero", mood: "sincere", text: "……这个世界的鞋子，是长在箱子里的吗。" },
      { who: "narrator", text: "是的。请不要深究。" },
    ],
    duel: [
      { who: "system", text: "电脑玩家加入了游戏。" },
      { who: "zero", mood: "smug", text: "来得正好。吾正缺一个祭品。" },
    ],
    curfew: [
      { who: "door", text: "小明！几点了还玩！再不睡我拉闸了！" },
      {
        choice: ["「凡人无法阻止吾。」", "「再五分钟。这是吾此生最后的请求。」", "「（假装没听见）」"],
        flag: "act2-curfew",
      },
      { who: "door", text: "三。" },
      { who: "zero", mood: "flustered", text: "等一下，" },
      { who: "door", text: "二。" },
      { who: "zero", mood: "flustered", text: "这一局马上，" },
      { who: "door", text: "一。" },
    ],
    blackout: [
      { who: "narrator", text: "全屋断电。" },
      { who: "narrator", text: "只有这块屏幕还亮着。它不应该还亮着。" },
    ],
    pulled: [
      { who: "zero", mood: "sincere", text: "这道光……难道说……" },
      { who: "zero", mood: "sincere", text: "没有卡车，没有女神，直接跳过了前置剧情！？" },
      { who: "zero", mood: "smug", text: "终于来了。吾应得的，异世界——！" },
    ],
    gone: [{ who: "narrator", text: "他是笑着被吸进去的。这一点请记录在案。" }],
  },
  goneArt: STORY_ART.comic2,
  checkpoint: "act2-done",
};
