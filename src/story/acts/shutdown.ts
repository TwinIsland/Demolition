import { SPOTS } from "../../modules/maps/flatland-story/layout.js";
import type { Hotspot, Line, RoomScene, StagedScene } from "../script";
import { SHUTDOWN_ART } from "../shutdown/art";
import { playShutdown } from "../shutdown/play";
import { BEDROOM } from "./bedroom";
import { STORY_ART } from "../assets";

/** A room of the "go back" ending: walked through once, towards the one thing that leaves it. */
export interface HomeRoom {
  background: string;
  foreground?: RoomScene["foreground"];
  animations?: RoomScene["animations"];
  cell: number;
  layout: readonly string[];
  walkOver?: string;
  /** Spoken on entering. */
  intro: readonly Line[];
  goal: string;
  /** The hotspot with `ends` leads on, once its lines are read. */
  hotspots: readonly Hotspot[];
}

/**
 * Act 5, "Shutdown", and both endings. Someone has pushed the breaker back in: the machine shuts
 * down before it restarts, the closing zone is its progress bar, and only one may leave. Teaches
 * the zone, field supplies, the minimap and a whole match, against three opponents at once.
 * The staging is in shutdown/play.ts; every word spoken is here.
 */
export const SHUTDOWN_SCRIPT = {
  /** Checkpoints: before the fight (failing returns here), and the story's end. */
  checkpoints: { fight: "act5-fight", done: "act5-done" },
  /** Seconds for the bar to fill. */
  zoneDuration: 130,
  /**
   * Cells of the small Flatland (modules/maps/flatland-story/layout.js). The hero stands on the
   * street south of the fountain plaza and looks north across it, to the gate.
   */
  spots: {
    hero: { x: SPOTS.plaza.centre.x, z: SPOTS.plaza.centre.z + 3 },
    lulu: { x: SPOTS.plaza.centre.x - 1, z: SPOTS.plaza.centre.z + 3 },
    /** Where the three land: the near edge of the plaza, two cells in front of the hero. */
    landing: [
      { x: 6, z: 8 },
      { x: 7, z: 8 },
      { x: 8, z: 8 },
    ],
    /** The "stay" ending: where the next player comes down, and the two who wait under the gate. */
    newcomer: { x: 7, z: 6 },
    guides: [
      { x: 6.75, z: 4.6 },
      { x: 7.45, z: 4.7 },
    ],
    /** Where they start the fight: three of the map's corner spawns, which a match keeps clear. */
    corners: [
      { x: 13, z: 1 },
      { x: 1, z: 13 },
      { x: 13, z: 13 },
    ],
  },
  kings: [
    { id: "king-bluescreen", name: "蓝屏", color: "#1f6feb", skin: "story-bluescreen" },
    { id: "king-popup", name: "弹窗", color: "#f2c230", skin: "story-popup" },
    { id: "king-antivirus", name: "杀毒", color: "#2fbf71", skin: "story-antivirus" },
  ],
  goals: {
    fight: "击败四天王（一共三个）",
    zone: "火墙在收缩：往中间走",
    supply: "场地补给落下了：看小地图",
  },
  lines: {
    voice: [
      { who: "door", text: "（从天上传来）这孩子，灯都不关就睡了。" },
      { who: "zero", mood: "flustered", text: "是母亲大人的声音……从世界之外！？" },
      { who: "lulu", mood: "pout", text: "有人把电闸推回去了。这台机器要先关机，才能重启。" },
    ],
    bar: [
      { who: "system", text: "正在关机。请勿关闭电源。3%。" },
      { who: "lulu", mood: "pout", text: "看见那圈火了吗。那是进度条。它走到哪，哪里就没了。" },
      { who: "zero", mood: "flustered", text: "没了是指……" },
      { who: "lulu", text: "就是没了。别站在外面。" },
      { who: "lulu", text: "还有一件事。关机之前，这个世界只让一个人出去。" },
    ],
    kings: [
      { who: "zero", mood: "smug", text: "四天王……！" },
      { who: "lulu", mood: "pout", text: "是三个。" },
      { who: "zero", mood: "flustered", text: "四天王为什么是三个？" },
      { who: "lulu", text: "一直是三个。这是传统。" },
      {
        choice: ["「吾一个人就够了。」", "「退后，露露。这是吾的战斗。」", "「……其实有点怕。」"],
        flag: "act5-resolve",
      },
      { who: "lulu", mood: "pout", text: "手都在抖还逞强。" },
      { who: "lulu", text: "听好了。躲开火，捡补给，看小地图，别在自己的炸药旁边咏唱。" },
      { who: "lulu", mood: "flustered", text: "然后……不许输。才不是为了你！是我的教学评分！" },
    ],
    /** Before the fight, when the act is resumed from its checkpoint. */
    resume: [{ who: "lulu", mood: "pout", text: "还是那三个。还是那圈火。这次看着点小地图。" }],
    /** After a defeat; a different one each time, then round again. */
    retries: [
      [
        { who: "lulu", mood: "pout", text: "……我就知道。" },
        { who: "lulu", text: "进度条我帮你倒回去了。才不是特意的！是系统有缓存！" },
      ],
      [
        { who: "lulu", mood: "pout", text: "你又在自己的炸药旁边咏唱了。" },
        { who: "zero", mood: "flustered", text: "那是……战术性咏唱。" },
        { who: "lulu", text: "战术性阵亡。再来。" },
      ],
      [
        { who: "lulu", mood: "flustered", text: "火！我说了躲开火！进度条不会等你摆完姿势！" },
        { who: "zero", mood: "sincere", text: "……再来一次。" },
      ],
      [
        { who: "lulu", mood: "pout", text: "三百年来，你是倒下次数第二多的。" },
        { who: "zero", mood: "flustered", text: "第一是谁。" },
        { who: "lulu", text: "张三。他是示例，他倒下是工作。" },
      ],
      [
        { who: "lulu", mood: "impressed", text: "……没关系。这次比上次多活了几秒。" },
        { who: "lulu", mood: "flustered", text: "才不是在安慰你！是在陈述数据！" },
      ],
    ],
    won: [
      { who: "system", text: "正在关机。97%。" },
      { who: "lulu", mood: "impressed", text: "打击器还能用一次。按下去，你就再升一维，回你原来的地方。" },
      { who: "zero", mood: "sincere", text: "那你呢？" },
      { who: "lulu", mood: "pout", text: "我是引导精灵。我在这里等下一个笨蛋。" },
      { who: "zero", mood: "sincere", text: "……" },
      { who: "zero", mood: "sincere", text: "我其实，没有什么封印。" },
      { who: "lulu", mood: "impressed", text: "我知道。" },
      { who: "zero", mood: "sincere", text: "右手是被猫抓的。" },
      { who: "lulu", mood: "impressed", text: "我知道。存档里写了。" },
      { who: "narrator", text: "他第一次没有用「吾」。没有人指出这一点。" },
    ],
    home: {
      parting: [
        { who: "zero", mood: "sincere", text: "我走了。" },
        { who: "lulu", mood: "impressed", text: "嗯。" },
        { who: "lulu", mood: "pout", text: "……下次别被自己炸死了。很丢人。" },
      ],
      table: [
        { who: "zero", mood: "sincere", text: "……饭还行。" },
        { who: "narrator", text: "这是他今年说的第一句普通的话。" },
        { who: "narrator", text: "世界依然平静。有一个人觉得，好像也没那么令人作呕。" },
      ],
    },
    stay: {
      parting: [
        { who: "zero", mood: "smug", text: "吾留下。这里需要一个引导者。" },
        { who: "lulu", mood: "flustered", text: "谁、谁需要你了！位置只有一个！" },
        { who: "lulu", mood: "pout", text: "……不过文本框可以分你一半。" },
      ],
      /** His welcome: the part that fits on one row of the box, and the part that does not. */
      welcome: {
        fits: "欢迎，被选中之人。吾名「漆黑之翼·零·",
        spill: "永劫回归之第七天堂·改·真·漆黑之牙·终焉·绝对领域·封印解除·完全体",
      },
      after: [
        { who: "narrator", text: "文本框放不下。" },
        { who: "lulu", mood: "pout", text: "他叫小明。我叫露露。按 [空格] 放炸药。" },
      ],
    },
  },
} as const satisfies Record<string, unknown>;

/**
 * The bedroom of act 1, on the morning after: the same grid under a new painting, with the
 * curtains open and the door for once the thing to walk to.
 */
const MORNING_BEDROOM: HomeRoom = {
  background: SHUTDOWN_ART.bedroomMorning,
  foreground: [{ sprite: SHUTDOWN_ART.bedroomDesk, x: 254, y: 68, feetY: 138 }],
  animations: [
    { sprite: STORY_ART.bedroomDust, columns: 2, rows: 2, frames: 4, fps: 4, x: 88, y: 64, opacity: 0.65 },
  ],
  cell: BEDROOM.cell,
  layout: BEDROOM.layout,
  walkOver: BEDROOM.walkOver,
  intro: [
    { who: "door", text: "小明，起来吃早饭。肉给你热过了。" },
    { who: "zero", mood: "sincere", text: "……" },
    { who: "zero", mood: "sincere", text: "来了。" },
  ],
  goal: "去吃早饭",
  hotspots: [
    {
      id: "curtains",
      symbol: "W",
      label: "窗帘",
      lines: [
        { who: "zero", mood: "sincere", text: "……原来对面那栋楼是黄色的。" },
        { who: "narrator", text: "窗帘上一次拉开，是搬进来那天。" },
      ],
    },
    {
      id: "mirror",
      symbol: "M",
      label: "镜子",
      lines: [
        { who: "zero", mood: "sincere", text: "……" },
        { who: "narrator", text: "镜子里的人四天没洗头。他决定吃完饭就去洗。" },
      ],
    },
    {
      id: "megumin",
      symbol: "P",
      label: "惠惠的海报",
      lines: [{ who: "zero", mood: "sincere", text: "一日一发。今天的那一发，吾……我已经放过了。" }],
    },
    {
      id: "aqua",
      symbol: "Q",
      label: "阿库娅的海报",
      lines: [
        { who: "zero", mood: "sincere", text: "引导的人选，其实挺重要的。" },
        { who: "aqua", text: "バーカ。" },
      ],
    },
    {
      id: "plush",
      symbol: "F",
      interactionRadius: 18,
      label: "琪露诺",
      lines: [
        { who: "cirno", text: "⑨。" },
        { who: "zero", mood: "sincere", text: "嗯。早。" },
      ],
    },
    {
      id: "desk",
      symbol: "N",
      interactionRadius: 24,
      label: "书桌",
      lines: [
        { who: "zero", mood: "sincere", text: "三桶泡面。今天不用开第四桶了。" },
        { who: "narrator", text: "手柄旁边，那台旧电脑的屏幕是黑的。按电源键，没有反应。" },
        { who: "narrator", text: "屏幕的右下角，有一个像素亮了一下。也可能是反光。" },
      ],
    },
    {
      id: "bed",
      symbol: "b",
      interactionRadius: 14,
      label: "床底",
      lines: [{ who: "zero", mood: "sincere", text: "魔导……旧电脑的箱子。先放着吧。" }],
    },
    {
      id: "door",
      symbol: "=",
      interactionRadius: 14,
      label: "房门",
      lines: [{ who: "narrator", text: "门没有锁。它从来没有锁过。" }],
      ends: true,
    },
  ],
};

/**
 * The dining room, traced over its painting in 8-pixel cells. Solid: # wall, R fridge, K the
 * cabinet with the rice cooker, W window, C calendar, L the hallway back, O the kitchen door,
 * T the tabletop; chairs use solid # cells so the approaches stay aligned with the room art.
 */
const DINING_ROOM: HomeRoom = {
  background: SHUTDOWN_ART.dining,
  animations: [{ sprite: SHUTDOWN_ART.diningMeal, columns: 2, rows: 2, frames: 4, fps: 4, x: 128, y: 86 }],
  cell: 8,
  layout: [
    "########################################",
    "########################################",
    "########################################",
    "########################################",
    "########################################",
    "########################################",
    "#################WWWWWWWWW####CCCC######",
    "##...RRRRKKKKK........................##",
    "##...RRRRKKKKK........................##",
    "##...RRRRKKKKK.....##.................##",
    "##.................##.................O#",
    "##.............TTTTTTTTTT.............O#",
    "##.............TTTTTTTTTT.............O#",
    "##.............TTTTTTTTTT.............O#",
    "#L.............TTTTTTTTTT.............O#",
    "#L.............TTTTTTTTTT.............O#",
    "#L....@............##.................O#",
    "#L.................##.................O#",
    "#L....................................##",
    "##....................................##",
    "##....................................##",
    "########################################",
  ],
  intro: [],
  goal: "走到餐桌旁，按 E 坐下吃饭",
  hotspots: [
    {
      id: "fridge",
      symbol: "R",
      label: "冰箱",
      lines: [
        { who: "narrator", text: "冰箱贴下面压着一张便签：「肉在第二层。别又只吃泡面。」" },
        { who: "narrator", text: "便签的日期是三天前。" },
      ],
    },
    {
      id: "cooker",
      symbol: "K",
      label: "电饭煲",
      lines: [{ who: "zero", mood: "sincere", text: "保温灯亮着。亮了一晚上。" }],
    },
    {
      id: "window",
      symbol: "W",
      label: "窗户",
      lines: [{ who: "zero", mood: "sincere", text: "是天。在「上」面。" }],
    },
    {
      id: "calendar",
      symbol: "C",
      label: "挂历",
      lines: [{ who: "narrator", text: "公元二零二六年。夏天还剩下一大半。" }],
    },
    {
      id: "hallway",
      symbol: "L",
      label: "走廊",
      lines: [{ who: "zero", mood: "sincere", text: "房间又不会跑。先吃饭。" }],
    },
    {
      id: "kitchen",
      symbol: "O",
      label: "厨房",
      lines: [
        { who: "door", text: "坐下吃，别站着。汤马上好。" },
        { who: "zero", mood: "flustered", text: "……哦。" },
      ],
    },
    {
      id: "table",
      symbol: "T",
      label: "坐下吃饭",
      interactionRadius: 18,
      lines: [{ who: "narrator", text: "一碗饭，一盘红烧肉，一双筷子。对面还摆着一副空碗筷。" }],
      ends: true,
    },
  ],
};

/** The act as the chapter list holds it. */
export const SHUTDOWN: StagedScene = {
  kind: "staged",
  id: "shutdown",
  play: (stage) => playShutdown(stage, SHUTDOWN_SCRIPT, { bedroom: MORNING_BEDROOM, dining: DINING_ROOM }),
};
