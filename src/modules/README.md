# 安装 Mod

这个目录里的皮肤、炸药涂装、地图、技能、物品和强化都可以直接编辑。每个内容包占一个子目录，入口为 `index.js`。发布版需要通过 HTTP 打开。

| 分类 | 目录 | 入口函数 |
| --- | --- | --- |
| Minecraft 角色皮肤 | `skins` | `defineSkin` |
| 炸药涂装 | `bomb-finishes` | `defineFinish` |
| 地图 | `maps` | `defineMap` |
| 技能 | `skills` | `defineSkill` |
| 物品和投掷物 | `items` | `defineItem` |
| 升级强化 | `perks` | `definePerk` |
| 基因改造 | `mutations` | `defineMutation` |

基因改造的配置包含名称、说明、图标和数值。入口通过 `defineMutation(config, { apply(player) { … } })` 定义获得一层时的效果。核心负责击杀判定、随机抽取以及层数、提示与音效。

内容包可通过 `translations` 提供英文和简体中文。语言代码为 `en` 和 `zh`，支持 `name`、`description`、`tag` 和 `subtitle`。例如，在配置中加入 `translations: { en: { name: "Scout" }, zh: { name: "侦察兵" } }`。缺少某个译文字段时，游戏显示该字段的原文。地图、皮肤与涂装使用同一格式。

主动强化实现 `use(player, context)`，返回 `true` 时消耗一层，并自动出现在主动强化列表。可选的 `canUse(player, state)` 同时控制界面和服务端规则，`aiShouldUse(player, state)` 决定 AI 何时发动。`perks/apocalypse` 通过 `context.requestTerrainReset(seconds)` 发起地形重排。`perks/dimension-collapse` 调用 `context.forceArenaView(duration, warningSeconds)`，全场预告结束后锁定二维视角。省略第二个参数时立即生效。

例如，添加游骑兵皮肤时，在 `skins/ranger/` 放入 Minecraft 格式的 `skin.png` 和以下 `index.js`。目录名和 ID 使用小写字母、数字与连字符，并以字母开头。其他类型的包可以复制同类目录作为起点。

```js
import { defineSkin } from "../../sdk.js";

export default defineSkin({
  id: "ranger",
  name: "游骑兵",
  texture: new URL("./skin.png", import.meta.url).href,
  model: "auto",
});
```

使用 `npm run preview` 预览发布版时，把目录放进 `dist/mods/` 对应分类，刷新页面即可。开发模式使用 `src/modules/` 下的相同目录结构。

普通静态服务器从 `mods/manifest.json` 读取目录名单。安装或移除包后，可以在发布目录运行 `node mods/reindex.mjs` 重新扫描，也可以直接在 JSON 对应分类数组中添加或移除目录名。已有包的 JS、配置和图片可以原地替换。静态主机应允许浏览器重新验证 `mods/` 下的文件。

每个包使用浏览器原生 ES 模块。相对导入带上 `.js` 后缀，包内图片或模型通过 `new URL("./文件名", import.meta.url).href` 引用。优先使用独立 ID 制作自定义包，升级游戏时内置同名文件会随版本更新。

物品、主动技能和强化的配置支持可选的 `sound`，例如 `sound: new URL("./activate.ogg", import.meta.url).href`。本机玩家成功使用物品、发动技能或领取强化时播放。省略时使用对应类别或强化稀有度的默认音效。

装备设置 `permanent: true` 后常驻转盘，不消耗库存，也不进入掉落池。`melee` 设置游戏格单位的触及距离、单次伤害和冷却。配置 `throwable.trajectory: "lob"` 的投掷物可在瞄准时越过掩体，普通近投沿用炸药的距离和地形限制。强化可通过 `"duration:shield"` 调整每次开启护盾的持续时间。

## 地图音乐与障碍物预设

在地图的 `defineMap` 配置中设置 `bgm` 和 `obstacles`。`artwork` 指向主页选图卡面，`backdrop` 指向全屏背景图。省略 `backdrop` 时使用卡面，两者都省略时显示实时三维地图。

每个可摧毁格按权重从 `obstacles` 里抽取一种障碍物，共用积分和掉落规则。障碍物由引擎统一提供，定义在 [`core/obstacles.ts`](../core/obstacles.ts)，地图只按 ID 引用：

| 分组标签 | 预设 ID |
| --- | --- |
| `storage` | `crate` 木箱、`pallet` 弹药箱托盘、`drum` 油桶 |
| `fortification` | `bags` 沙袋、`hesco` 防爆笼、`barricade` 混凝土路障 |
| `industrial` | `press` 液压机、`hopper` 料斗、`valve` 阀门管段、`robot-arm` 机械臂 |
| `woodland` | `oak` 橡树、`pine` 松树、`logs` 原木堆 |

```js
obstacles: [
  { use: "crate", weight: 20 },            // 单个预设
  { use: "set:industrial", weight: 40 },   // 整组预设，权重在组内平分
  { model: new URL("./generator.glb", import.meta.url).href, weight: 10,
    surface: "metal", height: 2, footprint: 0.86 },   // 地图自带模型
],
```

所有障碍物走同一条规则：模型立在 y = 0、以格子中心为原点；渲染器把它等比缩放到 `footprint × 格宽`（默认 0.86，格宽 2.4）和 `height` 之内。`surface` 取 `wood`、`metal` 或 `soft`，决定刀击声，自带模型默认 `metal`。省略 `obstacles` 时使用 `storage` 组。所有障碍物占用完整的碰撞格，所以模型应当填满大部分格子，让玩家一眼看出这格走不了。

自带 GLB 里名为 `df:<材质>` 的材质会换成引擎的共享材质，和内置障碍物保持同一套贴图与贴图密度。可用名称见 [`render/materials.ts`](../render/materials.ts) 的 `PALETTE`，例如 `df:planks`、`df:paint-olive`、`df:steel`、`df:hazard`、`df:concrete`。其他名称的材质保持原样。内置模型由 [`tools/model-forge`](../../tools/model-forge) 生成，开发服务器下打开 `/tools/model-forge/forge.html` 可重新导出。

旧地图的 `covers: [{ kind, weight }]` 仍然可用，`kind` 按预设 ID 解析，`low-bags` 显示为 `bags`。`vaultHeight` 字段已移除。

## 角色徽记

`defineSkin` 的 `emblem` 指向一张透明背景的方形图片（SVG、PNG 或 WebP）。该角色在对局中建造的木箱会在四面和顶面喷上这枚徽记，外圈是该选手的队伍颜色。未设置徽记的皮肤和导入的自定义皮肤使用默认五角星。

```js
export default defineSkin({
  id: "scout", name: "侦察兵", model: "default",
  texture: new URL("./skin.png", import.meta.url).href,
  emblem: new URL("./emblem.svg", import.meta.url).href,
});
```

在 `defineMap` 的第二个参数中实现 `randomizeTerrain(random, size)` 可启用练习重排和「灭世」。返回的 `tileAt` 可用 0 标出希望留空的通路。核心按地图偏好移动剩余掩体，并保留每件掩体的模型、朝向和耐久。出生区、固定墙、角色身体与当前可用的相邻出口、地面物品和炸药位置受保护。前哨基地会选择新的十字通路，仓储区则选择两条货道。`density` 和 `wallDensity` 控制开局生成。

近战装备的 `melee.coverDamage` 指定每次命中的掩体伤害，`melee.coverSounds` 按相同材质名指定音频路径。
