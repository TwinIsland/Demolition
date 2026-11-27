import { BotAgent } from "../../agents/bot-agent";
import type { GameSnapshot, Vec2 } from "../../core/types";
import { SPOTS } from "../../modules/maps/flatland-story/layout.js";
import { playIntroCard } from "../cutscenes/intro-card";
import { playLanding } from "../cutscenes/landing";
import { playRelicDrop } from "../cutscenes/relic-drop";
import { STORY_ART, STORY_SKINS } from "../assets";
import type { Director } from "../match/director";
import { playStagedMatch } from "../match/staged-match";
import type { Line, StagedScene } from "../script";

/** Every line of act 3, by the moment it is spoken. */
const LINES = {
  /** Read over the panorama, before the map itself is shown. */
  arrive: [
    { who: "zero", mood: "sincere", text: "（睁眼）陌生的天花板……" },
    { who: "narrator", text: "这里没有天花板。这里没有「上」。" },
  ],
  wake: [
    { who: "zero", mood: "smug", text: "也就是说，这里是异世界。那么首先——状态栏，打开！" },
    { who: "narrator", text: "没有反应。" },
    { who: "zero", mood: "smug", text: "Status, open！" },
    { who: "narrator", text: "没有反应。" },
    { who: "zero", mood: "flustered", text: "……ステータス、オープン。" },
    { who: "lulu", mood: "pout", text: "吵死了！大清早的喊什么喊！" },
  ],
  meet: [
    { who: "zero", mood: "sincere", text: "！？　出现了，引导新人的女神——" },
    { who: "lulu", mood: "pout", text: "谁是女神啊！我是新手引导精灵露露！" },
    { who: "lulu", mood: "impressed", text: "看清楚了，十六乘十六像素，这个世界分辨率最高的存在！" },
    { who: "zero", mood: "smug", text: "吾名「漆黑之翼·零」。是被这个世界选中的——" },
    { who: "lulu", mood: "pout", text: "名字太长了，文本框放不下。你就叫小零。" },
    { who: "zero", mood: "flustered", text: "是「零」！" },
    { who: "lulu", mood: "pout", text: "好的小明。" },
    { who: "zero", mood: "flustered", text: "你为什么会知道那个名字！？" },
    { who: "lulu", mood: "pout", text: "存档文件里写的。" },
    {
      choice: ["「吾是来拯救这个世界的。」", "「说吧，魔王在哪里。」", "「吾的作弊技能是什么？」"],
      flag: "act3-purpose",
    },
    { who: "lulu", mood: "pout", text: "这个世界没有魔王，没有作弊技能，也不需要你拯救。" },
    { who: "lulu", mood: "pout", text: "你有的只有这个。（递出一颗炸药）" },
    { who: "zero", mood: "sincere", text: "……就这？" },
    { who: "lulu", mood: "flustered", text: "就这。才、才不是我特意给你准备的！是每个新人都有！" },
  ],
  walls: [
    { who: "lulu", mood: "pout", text: "听好了，我只说一遍。灰色的是墙，炸不掉。木头的是箱子，炸得掉。" },
    { who: "zero", mood: "smug", text: "吾之爆炎可以贯穿一切。" },
    { who: "system", text: "按 [空格] 在脚下放置炸药。放下之后，请离开。" },
  ],
  wallHolds: [
    { who: "lulu", mood: "pout", text: "……" },
    { who: "zero", mood: "flustered", text: "……这面墙，被施加了上位结界。" },
    { who: "lulu", mood: "pout", text: "它就是一面墙。去炸箱子。" },
  ],
  coins: [
    { who: "zero", mood: "sincere", text: "箱子里有金币。" },
    { who: "lulu", mood: "pout", text: "对，拿好，之后可以买东西。" },
    { who: "zero", mood: "smug", text: "呵，这个世界也被资本腐蚀了吗。" },
    { who: "lulu", mood: "pout", text: "不要的话给我。" },
    { who: "zero", mood: "flustered", text: "……吾先代为保管。" },
  ],
  range: [
    { who: "lulu", mood: "pout", text: "炸药的火会往四个方向走，前、后、左、右。走多远看你的威力。" },
    { who: "zero", mood: "sincere", text: "那上面呢？" },
    { who: "lulu", mood: "pout", text: "……什么？" },
    { who: "zero", mood: "sincere", text: "上面。往上炸。" },
    { who: "lulu", mood: "pout", text: "「上」是什么？" },
    { who: "zero", mood: "flustered", text: "就是……上啊。（跳了一下，没跳起来）" },
    { who: "lulu", mood: "flustered", text: "你没事吧？要不要坐一会儿？" },
    { who: "narrator", text: "这个世界没有「上」。提起它的人，一般会被认为是累了。" },
    { who: "lulu", mood: "pout", text: "算了。放两颗炸药，让一颗的火碰到另一颗。" },
  ],
  chain: [
    { who: "zero", mood: "smug", text: "连锁……！这就是，无限爆炎制——" },
    { who: "lulu", mood: "pout", text: "叫「连锁」就行。" },
    { who: "zero", mood: "flustered", text: "让吾把名字起完。" },
    { who: "lulu", mood: "pout", text: "不行，文本框。" },
    { who: "lulu", mood: "pout", text: "下一个。站在炸药外面顶着它往前走，可以把它踢出去。" },
  ],
  kick: [
    { who: "zero", mood: "smug", text: "踢向敌人，再转身离去，不看爆炸。" },
    { who: "lulu", mood: "pout", text: "你会看的。所有人都会看的。" },
  ],
  firstDeath: [
    { who: "zero", mood: "sincere", text: "……吾，死了？" },
    { who: "zero", mood: "smug", text: "然后时间倒流了……原来如此，吾的能力是「死亡回归」！" },
    { who: "zero", mood: "sincere", text: "这份痛苦只有吾一人记得，无法告诉任何——" },
    { who: "lulu", mood: "pout", text: "你刚才被自己炸死了，我看见了。" },
    { who: "zero", mood: "flustered", text: "……你记得？" },
    { who: "lulu", mood: "impressed", text: "全都记得。很好笑。" },
    { who: "lulu", mood: "flustered", text: "才、才不是担心你才看着的！是我的工作！" },
  ],
  duelCall: [{ who: "lulu", mood: "impressed", text: "理论讲完了，来打一场。出来吧，示例对手！" }],
  duelIntro: [
    { who: "zhangsan", mood: "smile", text: "你好，我是【对手名称】。" },
    { who: "zero", mood: "sincere", text: "……他的台词是不是没填完。" },
    { who: "zhangsan", mood: "puzzled", text: "我将会【威胁内容】。准备好【动词】了吗。" },
    { who: "lulu", mood: "pout", text: "他一直这样。别欺负他。" },
    { who: "zero", mood: "smug", text: "以吾之名，赐你安息。" },
    { who: "narrator", text: "他说得好像自己一定会赢一样。" },
  ],
  defeat: [
    { who: "zhangsan", mood: "ko", text: "啊。我被【击败方式】了。" },
    { who: "zhangsan", text: "【在此填写遗言】。" },
    { who: "narrator", text: "他倒下了。按照流程，掉落了一件物品。" },
  ],
  relic: [
    { who: "system", text: "获得「升维打击器」。" },
    { who: "zero", mood: "sincere", text: "这是……！" },
    { who: "lulu", mood: "flustered", text: "别碰！那个东西很危险！" },
    { who: "lulu", mood: "pout", text: "听说按下去的人，会看见「上」。然后就再也回不来了。" },
    { who: "zero", mood: "sincere", text: "再也回不来……" },
    { who: "narrator", text: "他的眼睛亮了。" },
    { who: "lulu", mood: "flustered", text: "不许露出那种表情！" },
    { choice: ["「按下去。」", "「毫不犹豫地按下去。」", "「一边咏唱一边按下去。」"], flag: "act3-press" },
  ],
  /** Read over the last panel. */
  press: [
    { who: "lulu", mood: "flustered", text: "等等，起码把我——" },
    { who: "zero", mood: "smug", text: "与吾签订契约，一起成为三维生物吧！" },
    { who: "lulu", mood: "flustered", text: "谁要和你签——" },
  ],
} satisfies Record<string, readonly Line[]>;

const GOALS = {
  wall: "对着告示牌放一颗炸药",
  crates: "炸开箱子",
  chain: "用一颗炸药引爆另一颗",
  kick: "顶着炸药往前走，把它踢出去",
  duel: "击败示例对手",
};

/** Where the duel is staged: the dojo yard, with the guide watching from the street. */
const DUEL = SPOTS.dojo;
/** Out of sight until she makes her entrance. */
const OFFSTAGE: Vec2 = { x: 13, z: 13 };
const RESPAWN_SECONDS = 1.2;
const CRATE_GOAL = 3;
/** Less than his own blast costs him, until the duel. */
const FRAGILE_HP = 10;
const DUEL_HP = 100;

async function script(d: Director) {
  const { stage, match } = d;
  /** Conversations wait their turn: a death may want to speak while the lesson does. */
  let queue: Promise<boolean> = Promise.resolve(true);
  const say = (lines: readonly Line[]) => (queue = queue.then((ok) => ok && d.talk(lines)));
  const cutscene = async (play: (canvas: HTMLCanvasElement) => { done: Promise<void>; dispose(): void }) => {
    d.lock(true);
    const scene = play(stage.overlay());
    await scene.done;
    scene.dispose();
    d.lock(false);
  };

  // Death is part of the lesson: the hero comes back where the current lesson began.
  let home: Vec2 = SPOTS.arrival,
    died = false,
    over = false;
  const lives = async () => {
    while (!over) {
      if (!(await d.until((state) => !state.players[0].alive))) return;
      if (!(await d.seconds(RESPAWN_SECONDS)) || over) return;
      d.revive("you", home);
      if (!died) {
        died = true;
        void say(LINES.firstDeath);
      }
    }
  };
  void lives();

  // The lessons are about charges and nothing else: no crates of his own, no other equipment.
  match.gate = (input) => ({
    ...input,
    build: false,
    buildTarget: undefined,
    useEquipment: false,
    equip: undefined,
    resetTerrain: false,
  });
  stage.host.music("opening");
  await cutscene(playLanding);
  stage.art(STORY_ART.comic3);
  stage.root.classList.remove("veiled");
  if (!(await say(LINES.arrive))) return;
  stage.art();
  if (!(await say(LINES.wake))) return;
  await cutscene((canvas) =>
    playIntroCard(canvas, {
      skin: STORY_SKINS["story-lulu"],
      title: "露露",
      note: "新手引导精灵 · 16×16",
      tint: "#ff7a9a",
    }),
  );
  d.put("lulu", SPOTS.guide);
  d.face("lulu", SPOTS.arrival);
  d.face("you", SPOTS.guide);
  if (!(await say(LINES.meet))) return;
  stage.mark("act3-arrive");

  // A newcomer is fragile: one mistake with his own charge is the lesson on dying.
  const toughness = (hp: number) =>
    match.mutate((state) => {
      const hero = state.players[0];
      hero.hp = hero.maxHp = hp;
    });
  toughness(FRAGILE_HP);

  // 3.1 Walls hold, crates do not.
  if (!(await say(LINES.walls))) return;
  stage.goal(GOALS.wall);
  if (!(await d.until((state) => state.blasts.length > 0))) return;
  if (!(await d.until((state) => state.blasts.length === 0 && state.players[0].alive))) return;
  if (!(await say(LINES.wallHolds))) return;
  // Any three will do: he is free to pick his own.
  const standing = (state: Readonly<GameSnapshot>) =>
    state.tiles.reduce((sum, row) => sum + row.filter((tile) => tile === 2).length, 0);
  const before = standing(d.state);
  const opened = (state: Readonly<GameSnapshot>) => Math.min(CRATE_GOAL, before - standing(state));
  if (
    !(await d.until((state) => {
      stage.goal(`${GOALS.crates} ${opened(state)}/${CRATE_GOAL}`);
      return opened(state) === CRATE_GOAL && state.blasts.length === 0;
    }))
  )
    return;
  stage.goal();
  if (!(await say(LINES.coins))) return;

  // 3.2 Range, a chain, a kick.
  if (!(await say(LINES.range))) return;
  stage.goal(GOALS.chain);
  // A charge that goes off well before its own fuse was set off by another.
  const fuses = new Map<number, number>();
  if (
    !(await d.until((state) => {
      const live = new Set(state.bombs.map((bomb) => bomb.id));
      let chained = false;
      for (const [id, at] of fuses)
        if (!live.has(id)) {
          chained ||= state.time < at - 0.25;
          fuses.delete(id);
        }
      for (const bomb of state.bombs) fuses.set(bomb.id, bomb.detonateAt);
      return chained;
    }))
  )
    return;
  stage.goal();
  if (!(await d.until((state) => state.blasts.length === 0 && state.players[0].alive))) return;
  if (!(await say(LINES.chain))) return;
  match.mutate((state) => {
    const hero = state.players[0];
    if (!hero.skills.includes("kick")) hero.skills.push("kick");
  });
  stage.goal(GOALS.kick);
  if (!(await d.until((state) => state.bombs.some((bomb) => bomb.slide)))) return;
  stage.goal();
  if (!(await d.until((state) => state.bombs.length === 0 && state.blasts.length === 0))) return;
  if (!(await d.until((state) => state.players[0].alive))) return;
  if (!(await say(LINES.kick))) return;

  // 3.4 The sample opponent.
  if (!(await say(LINES.duelCall))) return;
  home = DUEL.hero;
  toughness(DUEL_HP);
  if (
    !(await d.cut(() => {
      d.put("you", DUEL.hero, Math.PI / 2);
      d.put("lulu", DUEL.guide, Math.PI / 2);
      d.put("zhangsan", DUEL.opponent, -Math.PI / 2);
    }))
  )
    return;
  await cutscene((canvas) =>
    playIntroCard(canvas, {
      skin: STORY_SKINS["story-zhangsan"],
      title: "【对手名称】",
      note: "示例对手 · 【在此填写简介】",
      tint: "#9aa3b5",
    }),
  );
  if (!(await say(LINES.duelIntro))) return;
  stage.host.music("duel");
  // He can be hurt from here on, and one good blast is enough.
  match.mutate((state) => {
    const rival = state.players.find((p) => p.id === "zhangsan")!;
    rival.invulnerableUntil = 0;
    rival.hp = rival.maxHp = 70;
  });
  match.setAgent("zhangsan", new BotAgent("zhangsan"));
  stage.goal(GOALS.duel);
  if (!(await d.until((state) => !state.players.find((p) => p.id === "zhangsan")!.alive))) return;
  over = true;
  match.setAgent("zhangsan");
  stage.goal();
  // Whatever is still burning is let burn out; nothing may kill the winner on the way to the ending.
  match.mutate((state) => {
    state.bombs = [];
    const hero = state.players[0];
    hero.invulnerableUntil = state.time + 4;
    if (!hero.alive) {
      hero.alive = true;
      hero.hp = hero.maxHp;
      Object.assign(hero, { x: DUEL.hero.x, z: DUEL.hero.z });
    }
  });
  stage.host.silence();
  if (!(await d.seconds(1.2))) return;
  if (!(await say(LINES.defeat))) return;
  await cutscene(playRelicDrop);
  stage.host.music("opening");
  if (!(await say(LINES.relic))) return;
  stage.art(STORY_ART.comic3b);
  if (!(await say(LINES.press))) return;
  stage.end("act3-done");
}

/**
 * Act 3, "Flatland": the first steps in the real game, seen from above. A guide teaches walls and
 * crates, blast range, chains and the kick; dying is a lesson too; a sample opponent closes it.
 */
export const FLATLAND: StagedScene = {
  kind: "staged",
  id: "flatland",
  play: (stage) =>
    playStagedMatch(
      stage,
      {
        mapId: "flatland-story",
        skin: "story-zero",
        setup: {
          spawn: SPOTS.arrival,
          yaw: 0,
          overhead: true,
          cast: [
            { id: "lulu", name: "露露", color: "#ff7a9a", skin: "story-lulu", passive: true, ...OFFSTAGE },
            {
              id: "zhangsan",
              name: "张三",
              color: "#9aa3b5",
              skin: "story-zhangsan",
              difficulty: "easy",
              // Parked out of the way, and out of harm's, until the duel.
              passive: true,
              x: OFFSTAGE.x - 1,
              z: OFFSTAGE.z,
            },
          ],
        },
      },
      script,
    ),
};
