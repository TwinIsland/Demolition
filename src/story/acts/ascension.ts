import type { Line, StagedScene } from "../script";
import { playAscension } from "../ascend/play";

/**
 * Act 4, "Ascension": the flat village stands up. One cutscene, then every thing the third
 * dimension brings, a lesson each: looking, sprinting, jumping, the knife, throwing, fire, the
 * shield, the bandage, building, the skill shop, levelling, and the zombies.
 *
 * This file is the words. What happens between them is in ascend/play.ts.
 */
export const ASCENSION: StagedScene = {
  kind: "staged",
  id: "ascension",
  play: (stage) => playAscension(stage),
};

/** A key's name is filled in where a line says `{action}`, from the player's own bindings. */
export const ASCENSION_LINES = {
  trigger: [{ who: "system", text: "「升维打击器」已启动。" }],
  arrive: [
    { who: "zero", mood: "smug", text: "哈哈哈哈！看啊！这就是吾真正的姿态！世界啊，在吾面前——" },
    { who: "zero", mood: "flustered", text: "呕。" },
    { who: "narrator", text: "他晕 3D。" },
  ],
  back: [
    { who: "lulu", mood: "flustered", text: "……这是什么。我后面这个是什么。" },
    { who: "zero", mood: "flustered", text: "（虚弱）那是你的背面。" },
    { who: "lulu", mood: "flustered", text: "我没有背面！我从来没有背面！" },
    { who: "lulu", mood: "pout", text: "不许看！转过去！你也有！你的也不许给我看！" },
    { who: "narrator", text: "三百年来，她第一次发现自己有后脑勺。" },
  ],
  sky: [
    { who: "lulu", mood: "impressed", text: "（抬头）……那个蓝色的，是什么？" },
    { who: "zero", mood: "sincere", text: "是天。在「上」面。" },
    { who: "lulu", mood: "impressed", text: "……" },
    { who: "lulu", mood: "pout", text: "也、也就一般般。" },
  ],

  // 4.1
  look: [
    { who: "lulu", mood: "flustered", text: "我、我也是第一次，所以我们一起……才不是一起！是我监督你！" },
    { who: "system", text: "移动鼠标环顾四周。" },
  ],
  sprint: [{ who: "system", text: "按住 [{sprint}] 冲刺，朝任何方向累计跑一段距离就行，也可以来回跑。" }],
  winded: [
    { who: "zero", mood: "smug", text: "呵，吾之神速——" },
    { who: "zero", mood: "flustered", text: "（喘气）" },
    { who: "narrator", text: "体力条少了一截。他平时最远的运动是走到冰箱。" },
    { who: "system", text: "体力会自己回复。按 [{jump}] 跳跃。" },
  ],
  jumped: [
    { who: "zero", mood: "sincere", text: "吾……飞起来了……" },
    { who: "lulu", mood: "pout", text: "那叫跳。零点四秒。" },
    { who: "zero", mood: "sincere", text: "这零点四秒，吾是自由的。" },
    { who: "narrator", text: "这句话他是认真的。" },
    { who: "lulu", mood: "impressed", text: "……再跳一次给我看。" },
    { who: "zero", mood: "flustered", text: "欸？" },
    { who: "lulu", mood: "flustered", text: "才不是觉得好看！是确认功能正常！" },
  ],
  jumpedAgain: [{ who: "lulu", mood: "pout", text: "……功能正常。下一项。" }],

  // 4.2
  hands: [
    {
      who: "lulu",
      mood: "pout",
      text: "三维有手了，手里可以拿东西。按住 [{gearWheel}]，移动鼠标选中刀，再松开就能切换。也可以滚动滚轮换。",
    },
    { who: "zero", mood: "smug", text: "终于……吾之佩剑，「漆黑之牙·终焉」。" },
    { who: "system", text: "获得「刀」。" },
    { who: "zero", mood: "smug", text: "是「漆黑之牙·终焉」。" },
    { who: "system", text: "「刀」。" },
    { who: "lulu", mood: "pout", text: "那边有个箱子。拿刀，走到它面前，按 [{use}] 砍两下。" },
  ],
  knifed: [
    { who: "zero", mood: "smug", text: "一刀两断。" },
    { who: "lulu", mood: "pout", text: "两刀。我数了。" },
    {
      who: "lulu",
      mood: "impressed",
      text: "教学箱子里是绷带，可以走过去收进装备栏。先收着，等会儿教你包扎。",
    },
  ],
  toWall: [{ who: "lulu", mood: "pout", text: "跟我来。下一样东西要隔着墙用。" }],
  grenade: [
    { who: "system", text: "获得「破片手榴弹」×3。" },
    {
      who: "lulu",
      mood: "pout",
      text: "矮墙那边你走不过去，但是能扔过去。手榴弹已经拿好了，瞄准墙后的空地，落点标记变绿后按 [{use}]。",
    },
  ],
  grenadeDone: [
    { who: "zero", mood: "sincere", text: "它……越过去了。从「上」面。" },
    { who: "lulu", mood: "impressed", text: "……嗯。从上面。" },
  ],
  molotov: [
    { who: "system", text: "获得「燃烧瓶」×2。" },
    {
      who: "lulu",
      mood: "pout",
      text: "这个落地会烧一片，烧着的地方谁都过不去，包括你。往路上扔一个，把路封住。",
    },
  ],
  molotovDone: [
    { who: "zero", mood: "smug", text: "燃烧吧，吾之黑炎！" },
    { who: "lulu", mood: "pout", text: "是橙色的。" },
    { who: "zero", mood: "flustered", text: "……在吾眼中是黑色的。" },
  ],
  shield: [
    { who: "system", text: "获得「战术护盾」，已拿在手里。" },
    {
      who: "lulu",
      mood: "pout",
      text: "就在原地，不用走到我前面，也不用朝着炸药。按 [{use}] 展开护盾，然后等着，我会在你身旁放炸药。",
    },
    {
      who: "system",
      text: "护盾最多持续 4.5 秒，挡住一次爆炸后破碎。若切走了装备，按 [{shield}] 切回护盾。",
    },
  ],
  shieldUp: [{ who: "zero", mood: "smug", text: "绝对领域，展开。" }],
  shieldRetry: [
    { who: "lulu", mood: "pout", text: "这次没挡住。护盾已经补好了，按 [{use}] 展开，然后原地等我放炸药。" },
  ],
  shieldDone: [
    { who: "lulu", mood: "pout", text: "挡住了！那个叫护盾，挡一次爆炸就会碎。" },
    { who: "zero", mood: "flustered", text: "欸。" },
  ],
  bleeding: [
    { who: "lulu", mood: "flustered", text: "你在流血！快用绷带！" },
    { who: "zero", mood: "flustered", text: "绷带……？（看自己的右臂）" },
    { who: "zero", mood: "smug", text: "不行。这是封印。解开的话，这个世界会——" },
    { who: "lulu", mood: "flustered", text: "背包里另外有！新的！" },
    { who: "system", text: "生命值 80/100。已拿好「绷带」，按 [{use}] 使用，恢复到 100/100。" },
  ],
  bandaged: [
    { who: "system", text: "使用「绷带」。生命恢复。" },
    { who: "zero", mood: "sincere", text: "…………" },
    { who: "zero", mood: "sincere", text: "原来，绷带是用来治伤的。" },
    { who: "narrator", text: "十六年来，他第一次正确使用了绷带。" },
    { who: "lulu", mood: "flustered", text: "……笨蛋。吓死我了。" },
    { who: "zero", mood: "sincere", text: "你刚才说什么？" },
    { who: "lulu", mood: "pout", text: "我说你是笨蛋！只有前半句！" },
  ],
  build: [{ who: "lulu", mood: "pout", text: "最后一样。看着前面的空地，按 [{build}]，搭一个木箱出来。" }],
  built: [
    { who: "zero", mood: "smug", text: "凭空造物。这是神的领域。" },
    { who: "lulu", mood: "pout", text: "是木箱的领域。你只有三个，省着用。站到箱子后面，看好了——" },
  ],
  blocked: [
    { who: "lulu", mood: "pout", text: "火线被箱子挡住了。箱子没了，你还在。" },
    { who: "zero", mood: "sincere", text: "……它替吾死了。" },
    { who: "lulu", mood: "pout", text: "它是箱子。" },
  ],

  // 4.3
  toShop: [
    {
      who: "lulu",
      mood: "pout",
      text: "前面有商店。金币终于有用了，这次买「战术透视」和「滑踢」。我把那两张卡框出来了，两个都买好再继续。",
    },
    { who: "zero", mood: "smug", text: "吾刚才说过这个世界被资本腐蚀了。" },
    { who: "lulu", mood: "pout", text: "那你买不买。" },
    { who: "zero", mood: "flustered", text: "买。" },
  ],
  shopEmpty: [
    { who: "lulu", mood: "pout", text: "「战术透视」和「滑踢」都要买好。点金框里的两张卡，买齐再继续。" },
  ],
  cast: [
    { who: "lulu", mood: "pout", text: "「{name}」的效果：{description}" },
    { who: "system", text: "按 [{skill}] 施放「{name}」，图标冷却完才能再用。" },
  ],
  castPassive: [
    { who: "system", text: "「{name}」是被动技能，一直生效。" },
    { who: "lulu", mood: "pout", text: "效果：{description} 不用找施放按键，按它本身的操作方式触发就行。" },
  ],
  castDone: [{ who: "lulu", mood: "impressed", text: "……用得还行。技能有冷却，图标亮了才能再用。" }],
  target: [
    {
      who: "lulu",
      mood: "pout",
      text: "看金色标记：农田里那个像人的假人就是训练靶。绕过商店，走过去，用刀、炸药或技能击倒它，就能升级。",
    },
    { who: "zero", mood: "sincere", text: "它长得有点像刚才那位。" },
    { who: "lulu", mood: "pout", text: "示例素材是共用的。" },
  ],
  levelled: [
    { who: "system", text: "升级会提高基础属性；强化卡是额外的奖励，下面三项任选一项。" },
    {
      who: "lulu",
      mood: "pout",
      text: "给你三项基础强化：快速移动让你跑得更快，强化体能增加并恢复血量，弹药携行让你同时多放一颗炸药。",
    },
    {
      who: "system",
      text: "等级提升。请选择一项强化：按 [{reward1}] [{reward2}] [{reward3}]，或按 [{expand}] 展开细看。",
    },
    { who: "zero", mood: "smug", text: "来了！作弊技能！" },
  ],
  perk: [
    { who: "zero", mood: "smug", text: "就叫它「永劫回归之第七天堂·改」。" },
    { who: "system", text: "「{name}」。" },
    { who: "zero", mood: "flustered", text: "……「永劫回归之第七天堂·改」。" },
    { who: "lulu", mood: "pout", text: "「{name}」。" },
    {
      who: "lulu",
      mood: "impressed",
      text: "效果是：{description} 这是被动强化，选好就生效，不需要再按技能键。",
    },
  ],

  // 4.4
  toGraves: [{ who: "lulu", mood: "pout", text: "……还有一样。跟我来，别出声。" }],
  risen: [
    { who: "zero", mood: "smug", text: "亡灵！？这个世界果然有魔王军！" },
    { who: "lulu", mood: "pout", text: "那是以前被吸进来的人。没通关的。" },
    { who: "zero", mood: "sincere", text: "……" },
    { who: "zero", mood: "sincere", text: "他们也喊过「状态栏打开」吗。" },
    { who: "lulu", mood: "impressed", text: "每一个都喊过。" },
    { who: "narrator", text: "这是全剧唯一一处他没有接话。" },
  ],
  fight: [
    { who: "lulu", mood: "pout", text: "……别发呆。他们不会等你。刀两下一个，炸药也行。" },
    {
      who: "lulu",
      mood: "impressed",
      text: "普通僵尸会留下绷带，等火熄了再靠近捡，收进装备栏后按之前教你的办法使用。",
    },
  ],
  mutant: [
    { who: "lulu", mood: "flustered", text: "头上有紫环的那只！它变异过，又快又硬。" },
    {
      who: "lulu",
      mood: "pout",
      text: "这只会留下护盾，还会把「生命突破」给你。先击倒它，再看获得的变异卡。",
    },
  ],
  mutated: [
    { who: "system", text: "获得变异「{name}」。变异是永久的，会一直叠加到这一局结束。" },
    {
      who: "lulu",
      mood: "impressed",
      text: "这次的效果：{description} 已经自动生效，不用装备，也不用按键。",
    },
    { who: "zero", mood: "sincere", text: "……吾拿走了他的东西。" },
    { who: "lulu", mood: "impressed", text: "是他留给下一个人的。" },
  ],
  revived: [{ who: "lulu", mood: "flustered", text: "笨蛋！站起来！……才不是担心你，是教学还没完！" }],
} satisfies Record<string, readonly Line[]>;

export const ASCENSION_GOALS = {
  look: "移动鼠标，看一圈",
  sprint: "按住 [{sprint}] 累计冲刺，方向不限",
  jump: "跳一次",
  jumpAgain: "再跳一次",
  knife: "按住 [{gearWheel}] 选中刀，再松开切换",
  knifeCut: "靠近木箱，按 [{use}] 用刀砍开",
  follow: "跟上露露",
  grenade: "把手榴弹扔过矮墙",
  molotov: "用燃烧瓶封住前面的路",
  shield: "按 [{use}] 展开护盾，无需靠近露露",
  shieldHold: "护盾已展开：原地等待爆炸，无需再次点击",
  bandage: "按 [{use}] 使用绷带，恢复到 100/100",
  build: "搭一个木箱",
  hide: "站到木箱后面",
  shop: "购买金框里的战术透视和滑踢",
  cast: "施放技能",
  target: "绕过商店，击倒金色标记的训练靶",
  perk: "选择一项强化",
  zombies: "清掉僵尸",
} as const;
