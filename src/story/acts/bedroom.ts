import { STORY_ART } from "../assets";
import { playBedroom } from "../bedroom-play";
import { bedroomMap } from "./home-map";
import type { RoomScene } from "../script";

/**
 * Act 1, "The mundane cage": the bedroom and its bathroom. Teaches walking and examining. The old
 * computer is in a locked box under the bed and the key is under the figurine in the bathroom;
 * the act ends when the computer is on the desk and powered through the floor strip.
 *
 * The rooms are laid out in home-map.ts; a hotspot here is opened by the prop that names its id.
 * The steps of the errand, and what the bed, the figurine, the desk and the strip say at each of
 * them, are in bedroom-play.ts.
 */
export const BEDROOM: RoomScene = {
  kind: "room",
  id: "bedroom",
  map: bedroomMap("night"),
  play: (stage) => playBedroom(stage, BEDROOM),
  opening: {
    art: STORY_ART.comic1,
    over: 2,
    lines: [
      { who: "narrator", text: "公元二零二六年。世界平静得令人作呕。" },
      { who: "narrator", text: "少年の名は「零」。被世界放逐的「選ばれし者」，右手に封印を宿す者。" },
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
      label: "惠惠的海报",
      lines: [
        { who: "zero", mood: "sincere", text: "吾之师。一日一发，绝不妥协。" },
        { who: "narrator", text: "他试过在房间里咏唱。隔壁敲了墙。" },
      ],
    },
    {
      id: "aqua",
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
      label: "琪露诺 fumo",
      lines: [
        { who: "zero", mood: "sincere", text: "冰之妖精……吾麾下最强的使魔。" },
        { who: "cirno", text: "baka！" },
        { who: "narrator", text: "玩偶没有发声装置。他检查过九次。" },
      ],
    },
    {
      id: "mirror",
      label: "镜子",
      lines: [
        { who: "zero", mood: "sincere", text: "镜中之人……你也在哭泣吗。" },
        { who: "narrator", text: "镜子里的人没有哭。镜子里的人在摆姿势。" },
      ],
    },
    {
      id: "shelf",
      label: "书架上的盒子",
      lines: [
        { who: "zero", mood: "smug", text: "安静点，吾的右手。时候还没到。" },
        { who: "narrator", text: "盒子里是备用的绷带。绷带下面是上周被猫抓的。" },
      ],
    },
    {
      id: "desk",
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
      id: "power-strip",
      label: "插线板",
      lines: [{ who: "narrator", text: "桌子下面的插线板。空插口正好能接上那台旧电脑。" }],
    },
    {
      id: "tissues",
      label: "纸团",
      lines: [
        { who: "zero", mood: "flustered", text: "……这是吾与花粉之邪神交战的痕迹。" },
        { who: "narrator", text: "他有鼻炎。请不要多想。" },
      ],
    },
    {
      id: "socks",
      label: "袜子",
      lines: [
        { who: "zero", mood: "sincere", text: "失散的左翼与右翼。它们已经很久没有相见了。" },
        { who: "narrator", text: "相距四米。" },
      ],
    },
    {
      id: "crisps",
      label: "薯片",
      lines: [
        { who: "zero", mood: "smug", text: "供奉给深渊的祭品。" },
        { who: "narrator", text: "过期两周。他昨天还吃了。" },
      ],
    },
    {
      id: "phone",
      label: "手机",
      lines: [
        { who: "zero", mood: "smug", text: "零条新消息。很好，吾不需要羁绊。" },
        { who: "narrator", text: "这是他今天第十四次确认这一点。" },
      ],
    },
    {
      id: "clock",
      label: "闹钟",
      lines: [
        { who: "zero", mood: "smug", text: "时间……不过是凡人给自己套上的枷锁。" },
        { who: "narrator", text: "闹钟设在早上七点。从来没有成功过。" },
      ],
    },
    {
      id: "box",
      label: "纸箱",
      lines: [
        { who: "zero", mood: "sincere", text: "封印之匣。里面沉睡着吾的过去。" },
        { who: "narrator", text: "小学的奖状，和一支竖笛。" },
      ],
    },
    {
      id: "window",
      label: "窗帘",
      lines: [
        { who: "zero", mood: "smug", text: "阳光是凡人的东西。" },
        { who: "narrator", text: "现在是晚上。" },
      ],
    },
    {
      id: "door",
      label: "房门",
      lines: [
        { who: "zero", mood: "flustered", text: "门的另一边是凡俗。吾不会踏出一步。" },
        { who: "narrator", text: "红烧肉的味道从门缝里进来了。他站了很久。" },
      ],
    },
    {
      id: "figurine",
      label: "手办",
      lines: [
        { who: "zero", mood: "sincere", text: "吾之至宝。为了不被凡俗的目光玷污，才供奉在这片圣域。" },
        { who: "narrator", text: "妈妈说放卧室落灰。卫生间其实更潮。" },
      ],
    },
    {
      id: "sink",
      label: "洗手台",
      lines: [
        { who: "zero", mood: "smug", text: "净化之泉。吾每日在此洗去凡尘。" },
        { who: "narrator", text: "水龙头在滴水。滴了一个月了。" },
      ],
    },
    {
      id: "toilet",
      label: "马桶",
      lines: [
        { who: "zero", mood: "sincere", text: "王座。吾曾在此思考世界的终焉。" },
        { who: "narrator", text: "也在这里刷了三小时手机。腿麻了。" },
      ],
    },
    {
      id: "bathtub",
      label: "浴缸",
      lines: [
        { who: "zero", mood: "smug", text: "冥河之水。凡人浸入，便会失去斗志。" },
        { who: "narrator", text: "泡澡确实很舒服。" },
      ],
    },
    {
      id: "washer",
      label: "洗衣机",
      lines: [
        { who: "zero", mood: "sincere", text: "混沌的漩涡……它吞噬过吾的一只袜子。" },
        { who: "narrator", text: "没有。两只都在卧室地上。" },
      ],
    },
    {
      id: "basket",
      label: "脏衣篮",
      lines: [
        { who: "zero", mood: "flustered", text: "这些是……吾褪下的旧铠甲。" },
        { who: "narrator", text: "三天的量。" },
      ],
    },
    {
      id: "under-bed",
      label: "床底",
      lines: [
        { who: "zero", mood: "sincere", text: "这是……父亲大人遗留的魔导器！？" },
        { who: "narrator", text: "父亲健在。在客厅看电视。这是一台二手电脑。" },
        { who: "zero", mood: "smug", text: "封印解除——！先把它搬到吾的祭坛上。" },
      ],
    },
  ],
  outro: [
    { who: "system", text: "正在启动。请勿关闭电源。" },
    { who: "narrator", text: "桌面上只有一个图标：泡泡 X。" },
    { who: "zero", mood: "smug", text: "原来如此。这就是命运石之门的选择。" },
  ],
  checkpoint: "act1-done",
};
