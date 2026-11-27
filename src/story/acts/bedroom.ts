import { STORY_ART } from "../assets";
import type { RoomScene } from "../script";

/**
 * Act 1, "The mundane cage": the bedroom. Teaches walking and examining, and ends when the old
 * computer under the bed is switched on.
 *
 * The layout is traced over the painting in 8-pixel cells. Solid: # wall, W curtains, P and Q
 * the two posters, M mirror, S bookshelf, B bed, F the plush on it, b the gap under the bed,
 * N desk, D chair and bin, X cardboard box, = door. Walked over: t tissues, s socks, p phone,
 * c crisps, a alarm clock.
 */
export const BEDROOM: RoomScene = {
  id: "bedroom",
  background: STORY_ART.bedroom,
  cell: 8,
  layout: [
    "########################################",
    "########################################",
    "########################################",
    "########################################",
    "########################################",
    "########################################",
    "########################################",
    "###########WWWWW#PPPP#QQQQMMMSSSS#######",
    "##BBBBBBBFF.tt...................NNNNN##",
    "##BBBBBBBFF...aa...............DDNNNNN##",
    "##BBBBBBBFF.pp.................DDNNNNN##",
    "##BBBBBBBBB......ss............DDNNNNN##",
    "##BBBBBBBBB...........@........DDNNNNN##",
    "##BBBBBBBBB.tt.................DDNNNNN##",
    "##BBBBBBBBB...cc.................NNNNN##",
    "##bbbbbbbbb...cc.................NNNNN##",
    "##XXXX.....................ss.......DD##",
    "##XXXX.tt......................tt.....##",
    "##XXXX................................##",
    "##################====##################",
    "########################################",
    "########################################",
  ],
  walkOver: "tspca",
  opening: {
    art: STORY_ART.comic1,
    lines: [
      { who: "narrator", text: "公元二零二六年。世界平静得令人作呕。" },
      { who: "narrator", text: "至少有一个人是这么认为的。" },
      { who: "zero", mood: "smug", text: "呵……又是这样无聊的一天。这个世界，果然容不下吾。" },
    ],
  },
  intro: [
    { who: "door", text: "小明！吃饭了！" },
    { who: "zero", mood: "smug", text: "……那是凡俗世界对吾的召唤。吾，拒绝。" },
    { who: "door", text: "今天有红烧肉！" },
    { who: "zero", mood: "flustered", text: "…………" },
    {
      choice: ["「吾早已舍弃了味觉。」", "「红烧肉……不过是束缚灵魂的锁链。」", "「（咽口水）吾，拒绝。」"],
      flag: "act1-dinner",
    },
    { who: "door", text: "那我给你留着。" },
    { who: "narrator", text: "他赢了。他什么也没得到。" },
  ],
  goal: "调查床底",
  hotspots: [
    {
      id: "megumin",
      symbol: "P",
      label: "惠惠的海报",
      lines: [
        { who: "zero", mood: "sincere", text: "吾之师。一日一发，绝不妥协。" },
        { who: "narrator", text: "他试过在房间里咏唱。隔壁敲了墙。" },
      ],
    },
    {
      id: "aqua",
      symbol: "Q",
      label: "阿库娅的海报",
      lines: [
        { who: "zero", mood: "smug", text: "没用的女神啊。吾若转生，绝不选你。" },
        { who: "aqua", text: "バーカ。" },
        { who: "zero", mood: "flustered", text: "……！？" },
        { who: "narrator", text: "海报不会说话。大概。" },
      ],
    },
    {
      id: "cirno",
      symbol: "F",
      label: "琪露诺 fumo",
      lines: [
        { who: "zero", mood: "sincere", text: "冰之妖精……吾麾下最强的使魔。" },
        { who: "cirno", text: "baka！" },
        { who: "narrator", text: "玩偶没有发声装置。他检查过九次。" },
      ],
    },
    {
      id: "mirror",
      symbol: "M",
      label: "镜子",
      lines: [
        { who: "zero", mood: "sincere", text: "镜中之人……你也在哭泣吗。" },
        { who: "narrator", text: "镜子里的人没有哭。镜子里的人三天没洗头。" },
      ],
    },
    {
      id: "shelf",
      symbol: "S",
      label: "书架上的盒子",
      lines: [
        { who: "zero", mood: "smug", text: "安静点，吾的右手。时候还没到。" },
        { who: "narrator", text: "盒子里是备用的绷带。绷带下面是上周被猫抓的。" },
      ],
    },
    {
      id: "desk",
      symbol: "N",
      label: "书桌",
      lines: [],
      cycle: [
        {
          label: "泡面",
          lines: [{ who: "zero", mood: "smug", text: "四具空壳。这就是吾战斗过的证明。" }],
        },
        {
          label: "抽纸",
          lines: [
            { who: "zero", mood: "smug", text: "圣遗物，「千之白羽」。" },
            { who: "narrator", text: "抽纸。超市买二送一。" },
          ],
        },
        {
          label: "手柄",
          lines: [
            { who: "zero", mood: "smug", text: "吾之双手，记得一万场战斗。" },
            { who: "narrator", text: "左摇杆漂移。他坚称这是风格。" },
          ],
        },
        {
          label: "漫画",
          lines: [
            { who: "zero", mood: "smug", text: "禁书。凡人翻阅会失去理智。" },
            { who: "narrator", text: "第七卷被借走两年了。他没有开口要回来。" },
          ],
        },
        {
          label: "台灯",
          lines: [
            { who: "zero", mood: "flustered", text: "这间屋子里唯一的光。……是吾允许它亮着的。" },
            { who: "narrator", text: "他怕黑。" },
          ],
        },
      ],
    },
    {
      id: "tissues",
      symbol: "t",
      label: "纸团",
      lines: [
        { who: "zero", mood: "flustered", text: "……这是吾与花粉之邪神交战的痕迹。" },
        { who: "narrator", text: "他有鼻炎。请不要多想。" },
      ],
    },
    {
      id: "socks",
      symbol: "s",
      label: "袜子",
      lines: [
        { who: "zero", mood: "sincere", text: "失散的左翼与右翼。它们已经很久没有相见了。" },
        { who: "narrator", text: "相距四米。" },
      ],
    },
    {
      id: "crisps",
      symbol: "c",
      label: "薯片",
      lines: [
        { who: "zero", mood: "smug", text: "供奉给深渊的祭品。" },
        { who: "narrator", text: "过期两周。他昨天还吃了。" },
      ],
    },
    {
      id: "phone",
      symbol: "p",
      label: "手机",
      lines: [
        { who: "zero", mood: "smug", text: "零条新消息。很好，吾不需要羁绊。" },
        { who: "narrator", text: "这是他今天第十四次确认这一点。" },
      ],
    },
    {
      id: "clock",
      symbol: "a",
      label: "闹钟",
      lines: [
        { who: "zero", mood: "smug", text: "时间……不过是凡人给自己套上的枷锁。" },
        { who: "narrator", text: "闹钟设在早上七点。从来没有成功过。" },
      ],
    },
    {
      id: "box",
      symbol: "X",
      label: "纸箱",
      lines: [
        { who: "zero", mood: "sincere", text: "封印之匣。里面沉睡着吾的过去。" },
        { who: "narrator", text: "小学的奖状，和一支竖笛。" },
      ],
    },
    {
      id: "window",
      symbol: "W",
      label: "窗帘",
      lines: [
        { who: "zero", mood: "smug", text: "阳光是凡人的东西。" },
        { who: "narrator", text: "现在是晚上。" },
      ],
    },
    {
      id: "door",
      symbol: "=",
      label: "房门",
      lines: [
        { who: "zero", mood: "flustered", text: "门的另一边是凡俗。吾不会踏出一步。" },
        { who: "narrator", text: "红烧肉的味道从门缝里进来了。他站了很久。" },
      ],
    },
    {
      id: "under-bed",
      symbol: "b",
      label: "床底",
      ends: true,
      lines: [
        { who: "zero", mood: "sincere", text: "这是……父亲大人遗留的魔导器！？" },
        { who: "narrator", text: "父亲健在。在客厅看电视。这是一台二手电脑。" },
        { who: "zero", mood: "smug", text: "封印解除——！" },
      ],
    },
  ],
  outro: [
    { who: "system", text: "正在启动。请勿关闭电源。" },
    { who: "narrator", text: "桌面上只有一个图标：泡泡 X。" },
    { who: "zero", mood: "smug", text: "原来如此。这就是命运石之门的选择。" },
  ],
  checkpoint: "act1-done",
  endCard: { title: "第一幕　凡俗的牢笼", note: "进度已保存 · 未完待续" },
};
