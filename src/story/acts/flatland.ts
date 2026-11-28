import { BotAgent } from "../../agents/bot-agent";
import { idleInput } from "../../core/types";
import type { AgentContext, GameSnapshot, PlayerAgent, PlayerInput, Vec2 } from "../../core/types";
import { SPOTS } from "../../modules/maps/flatland-story/layout.js";
import { playIntroCard } from "../cutscenes/intro-card";
import { playLanding } from "../cutscenes/landing";
import { playRelicDrop } from "../cutscenes/relic-drop";
import type { Cutscene } from "../cutscenes/kit";
import { LessonMarkers } from "../match/lesson-markers";
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
  ],
  wallHolds: [
    { who: "lulu", mood: "pout", text: "……" },
    { who: "zero", mood: "flustered", text: "……这面墙，被施加了上位结界。" },
    { who: "lulu", mood: "pout", text: "它就是一面墙。去炸箱子。" },
  ],
  coins: [
    { who: "zero", mood: "sincere", text: "炸开箱子就有金币。" },
    { who: "lulu", mood: "pout", text: "对，直接到账，看右下角。" },
    { who: "zero", mood: "smug", text: "呵，这个世界也被资本腐蚀了吗。" },
    { who: "lulu", mood: "pout", text: "不要的话给我。" },
    { who: "zero", mood: "flustered", text: "……吾先代为保管。" },
  ],
  range: [
    { who: "lulu", mood: "pout", text: "爆炸只沿四个方向走。" },
    { who: "zero", mood: "sincere", text: "那上面呢？" },
    { who: "lulu", mood: "pout", text: "……什么？" },
    { who: "zero", mood: "sincere", text: "上面。往上炸。" },
    { who: "lulu", mood: "pout", text: "「上」是什么？" },
    { who: "zero", mood: "flustered", text: "就是……上啊。（跳了一下，没跳起来）" },
    { who: "lulu", mood: "flustered", text: "你没事吧？要不要坐一会儿？" },
    { who: "narrator", text: "这个世界没有「上」。提起它的人，一般会被认为是累了。" },
    {
      who: "lulu",
      mood: "pout",
      text: "火线碰到另一颗炸药，会把它提前引爆。试试看。",
    },
  ],
  chain: [
    { who: "zero", mood: "smug", text: "连锁……！这就是，无限爆炎制——" },
    { who: "lulu", mood: "pout", text: "叫「连锁」就行。" },
    { who: "zero", mood: "flustered", text: "让吾把名字起完。" },
    { who: "lulu", mood: "pout", text: "不行，文本框。" },
    {
      who: "lulu",
      mood: "pout",
      text: "给你「滑踢」。退离炸药，再持续朝它走，就能踢出去。",
    },
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
  duelCall: [
    {
      who: "lulu",
      mood: "impressed",
      text: "来场实战。出来吧，示例对手！",
    },
  ],
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
  wall: "试着炸开告示牌",
  crates: "炸开箱子",
  chain: "触发一次连锁爆炸",
  kick: "踢出一颗炸药",
  duel: "击败示例对手",
};

/** Where the duel is staged: the dojo yard, with the guide watching from the street. */
const DUEL = SPOTS.dojo;
/** Out of sight until she makes her entrance. */
const OFFSTAGE: Vec2 = { x: 13, z: 13 };
const RESPAWN_SECONDS = 1.2;
const CRATE_GOAL = 3;
const DUEL_HP = 100;

/** How the sample opponent is held back: weak charges, slow feet, long pauses. */
const SAMPLE = { attack: 30, speed: 1.7, bombEvery: 5, actFor: 1.6, restFor: 1.4 };

/**
 * The sample opponent: the game's own bot with everything but walking and planting taken away,
 * who stops to think every few steps and plants one charge at a time, rarely.
 */
class SampleOpponent implements PlayerAgent {
  private readonly bot: BotAgent;
  private nextBomb = 0;
  constructor(readonly playerId: string) {
    this.bot = new BotAgent(playerId);
  }
  decide(context: AgentContext): PlayerInput {
    const wish = this.bot.decide(context),
      time = context.state.time,
      resting = time % (SAMPLE.actFor + SAMPLE.restFor) > SAMPLE.actFor;
    const input = idleInput(wish.yaw);
    if (resting) return input;
    input.moveX = wish.moveX;
    input.moveZ = wish.moveZ;
    input.preferAxis = wish.preferAxis;
    if ((wish.plantHere || wish.useEquipment) && time >= this.nextBomb) {
      input.plantHere = true;
      this.nextBomb = time + SAMPLE.bombEvery;
    }
    return input;
  }
  reset() {
    this.bot.reset?.();
  }
}

async function script(d: Director) {
  const { stage, match } = d;
  stage.root.dataset.tutorial = "flatland";
  d.lock(true);
  let finished = false,
    stopped = false,
    film: Cutscene | undefined;
  let targets: (state: Readonly<GameSnapshot>) => readonly Vec2[] = () => [];
  const markers = new LessonMarkers(match.scene);
  void d
    .until((state) => {
      if (film) film.paused = match.paused;
      markers.show(targets(state), state.size, state.time);
      return finished;
    })
    .then((complete) => {
      stopped = !complete;
      film?.dispose();
      markers.dispose();
    });
  /** Conversations wait their turn: a death may want to speak while the lesson does. */
  let queue: Promise<boolean> = Promise.resolve(true);
  const say = (lines: readonly Line[]) => (queue = queue.then((ok) => ok && d.talk(lines)));
  const cutscene = async (
    play: (canvas: HTMLCanvasElement) => Cutscene,
    reveal?: () => void | Promise<boolean>,
  ) => {
    d.lock(true);
    const canvas = stage.overlay();
    const scene = (film = play(canvas));
    await scene.done;
    if (stopped) return false;
    // A picture fades in over the film's last frame; the film leaves only once it is covered.
    if ((await reveal?.()) === false) return false;
    canvas.classList.add("leaving");
    const open = await d.seconds(0.32);
    scene.dispose();
    film = undefined;
    return open;
  };
  const calm = async () => {
    d.lock(true);
    targets = () => [];
    return (
      (await d.until((state) => !state.bombs.length && !state.blasts.length && d.hero.alive)) &&
      d.seconds(0.3)
    );
  };

  // Death is part of the lesson: the hero comes back where the current lesson began.
  let home: Vec2 = SPOTS.arrival,
    died = false,
    over = false;
  try {
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
    match.mutate((state) => {
      for (const actor of state.players) if (actor.bot) actor.alive = false;
    });
    if (
      !(await cutscene(playLanding, async () => {
        const shown = await stage.art(STORY_ART.comic3);
        stage.root.classList.remove("veiled");
        return shown;
      }))
    )
      return;
    if (!(await say(LINES.arrive))) return;
    stage.art();
    if (!(await d.seconds(0.7))) return;
    if (!(await say(LINES.wake))) return;
    if (
      !(await cutscene(
        (canvas) =>
          playIntroCard(canvas, {
            skin: STORY_SKINS["story-lulu"],
            title: "露露",
            note: "新手引导精灵 · 16×16",
            tint: "#ff7a9a",
          }),
        () => {
          match.mutate((state) => {
            state.players.find((p) => p.id === "lulu")!.alive = true;
          });
          d.put("lulu", SPOTS.guide);
          d.face("lulu", SPOTS.arrival);
          d.face("you", SPOTS.guide);
        },
      ))
    )
      return;
    if (!(await say(LINES.meet))) return;
    stage.mark("act3-arrive");

    // Health and the fixed starting kit stay predictable throughout the protected lesson.
    const toughness = (hp: number) =>
      match.mutate((state) => {
        const hero = state.players[0];
        hero.hp = hero.maxHp = hp;
      });
    toughness(DUEL_HP);
    const baseline = d.hero.stats?.coverDestroyed ?? 0;
    const opened = (state: Readonly<GameSnapshot>) =>
      Math.min(CRATE_GOAL, (state.players[0].stats?.coverDestroyed ?? 0) - baseline);

    // 3.1 Walls hold, crates do not.
    if (!(await say(LINES.walls))) return;
    stage.goal(GOALS.wall);
    d.lock(false);
    if (
      !(await d.until((state) =>
        state.blasts.some((blast) => {
          if (blast.ownerId !== d.hero.id || blast.originX === undefined || blast.originZ === undefined)
            return false;
          const dx = SPOTS.notice.x - blast.originX,
            dz = SPOTS.notice.z - blast.originZ;
          return (
            (!dx || !dz) &&
            Math.abs(dx) + Math.abs(dz) <= (blast.range ?? d.hero.range) &&
            blast.x === SPOTS.notice.x - Math.sign(dx) &&
            blast.z === SPOTS.notice.z - Math.sign(dz)
          );
        }),
      ))
    )
      return;
    if (!(await calm())) return;
    if (!(await say(LINES.wallHolds))) return;
    // Work done by the first charge counts too; never ask for three additional crates.
    stage.goal(`${GOALS.crates} ${opened(d.state)}/${CRATE_GOAL}`);
    d.lock(false);
    if (
      !(await d.until((state) => {
        stage.goal(`${GOALS.crates} ${opened(state)}/${CRATE_GOAL}`);
        return opened(state) === CRATE_GOAL;
      }))
    )
      return;
    if (!(await calm())) return;
    stage.goal();
    match.hud = ["coins"];
    if (!(await say(LINES.coins))) return;

    // 3.2 Range, a chain, a kick.
    const chainCells = [SPOTS.chainLane.from, { x: SPOTS.chainLane.from.x + 1, z: SPOTS.chainLane.from.z }];
    targets = () => chainCells;
    if (!(await say(LINES.range))) return;
    stage.goal(GOALS.chain);
    match.mutate((state) => {
      state.players[0].capacity = Math.max(2, state.players[0].capacity);
    });
    // A charge that goes off well before its own fuse was set off by another.
    const fuses = new Map<number, number>();
    d.lock(false);
    if (
      !(await d.until((state) => {
        const live = new Set(state.bombs.map((bomb) => bomb.id));
        let chained = false;
        for (const [id, at] of fuses)
          if (!live.has(id)) {
            chained ||= state.time < at - 0.05 && state.blasts.some((blast) => blast.explosionId === id);
            fuses.delete(id);
          }
        for (const bomb of state.bombs)
          if (bomb.ownerId === d.hero.id && !fuses.has(bomb.id)) fuses.set(bomb.id, bomb.detonateAt);
        return chained;
      }))
    )
      return;
    if (!(await calm())) return;
    stage.goal();
    match.mutate((state) => {
      const hero = state.players[0];
      if (!hero.skills.includes("kick")) hero.skills.push("kick");
    });
    targets = () => [SPOTS.kickLane.from];
    if (!(await say(LINES.chain))) return;
    stage.goal(GOALS.kick);
    const planted = new Map<number, Vec2>();
    d.lock(false);
    if (
      !(await d.until((state) => {
        // A kicked charge can reach a blocker and explode between two rendered frames.
        for (const bomb of state.bombs) {
          if (bomb.slide?.kickerId === d.hero.id) return true;
          if (bomb.ownerId !== d.hero.id) continue;
          const origin = planted.get(bomb.id);
          if (origin && (origin.x !== bomb.x || origin.z !== bomb.z)) return true;
          planted.set(bomb.id, { x: bomb.x, z: bomb.z });
        }
        return state.blasts.some((blast) => {
          if (blast.ownerId !== d.hero.id || blast.explosionId === undefined) return false;
          const origin = planted.get(blast.explosionId);
          return (
            !!origin &&
            blast.originX !== undefined &&
            blast.originZ !== undefined &&
            (origin.x !== blast.originX || origin.z !== blast.originZ)
          );
        });
      }))
    )
      return;
    if (!(await calm())) return;
    stage.goal();
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
        match.mutate((state) => {
          state.players.find((p) => p.id === "zhangsan")!.alive = true;
        });
      }))
    )
      return;
    if (
      !(await cutscene((canvas) =>
        playIntroCard(canvas, {
          skin: STORY_SKINS["story-zhangsan"],
          title: "【对手名称】",
          note: "示例对手 · 【在此填写简介】",
          tint: "#9aa3b5",
        }),
      ))
    )
      return;
    if (!(await say(LINES.duelIntro))) return;
    stage.host.music("duel");
    // He can be hurt from here on, and one good blast is enough.
    match.mutate((state) => {
      const rival = state.players.find((p) => p.id === "zhangsan")!;
      rival.invulnerableUntil = 0;
      rival.hp = rival.maxHp = 70;
      // A sample has nothing but the basic charge, and a weak one.
      rival.skills = [];
      rival.perks = [];
      rival.offers = [];
      rival.capacity = 1;
      rival.range = 1;
      rival.attack = SAMPLE.attack;
      rival.speed = SAMPLE.speed;
    });
    match.setAgent("zhangsan", new SampleOpponent("zhangsan"));
    stage.goal(GOALS.duel);
    d.lock(false);
    if (!(await d.until((state) => !state.players.find((p) => p.id === "zhangsan")!.alive))) return;
    over = true;
    d.lock(true);
    targets = () => [];
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
    if (!(await cutscene(playRelicDrop, () => stage.art(STORY_ART.comic3b)))) return;
    stage.host.music("opening");
    if (!(await say(LINES.relic))) return;
    if (!(await say(LINES.press))) return;
    stage.end("act3-done");
  } finally {
    finished = true;
    over = true;
    film?.dispose();
    markers.dispose();
  }
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
          tutorial: true,
          equipmentDrops: false,
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
