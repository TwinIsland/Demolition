import { STORY_ART } from "../assets";
import type { RoomScene } from "../script";

/**
 * Act 1, "The mundane cage": the bedroom. Teaches walking and examining, and ends when the old
 * computer under the bed is switched on.
 *
 * The layout is traced over the painting in 8-pixel cells: # wall, W curtains, P posters,
 * M mirror, S bookshelf, B bed, b the gap under its foot, N the desk with the noodle cups,
 * D chair and drawers, = door.
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
    "#########WWWWWW#PPPPPPPPPP#MMMMSSSSSS###",
    "#BBBBBBBB..................MMMM..NNNNNN#",
    "#BBBBBBBB..................MMMM..NNNNNN#",
    "#BBBBBBBB........................NNNNNN#",
    "#BBBBBBBB......................DDDNNNNN#",
    "#BBBBBBBB...........@..........DDDNNNNN#",
    "#BBBBBBBB......................DDDNNNNN#",
    "#BBBBBBBB......................DDDDDDDD#",
    "#BBBBBBBB......................DDDDDDDD#",
    "#BBBBBBBB........======........DDDDDDDD#",
    "#BBBBBBBB........======...........DDDDD#",
    "#bbbbbbbb........======...........DDDDD#",
    "#bbbbbbbb........======................#",
    "#................======................#",
    "########################################",
  ],
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
      id: "noodles",
      symbol: "N",
      label: "泡面",
      lines: [{ who: "zero", mood: "smug", text: "三具空壳。这就是吾战斗过的证明。" }],
    },
    {
      id: "poster",
      symbol: "P",
      label: "海报",
      lines: [{ who: "zero", mood: "sincere", text: "总有一天，吾也会被卡车选中的。" }],
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
