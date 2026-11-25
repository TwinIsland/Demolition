# 扩展与接口

## 数据流

```text
KeyboardAgent / BotAgent
       │ decide(AgentContext) → PlayerInput
       ▼
MatchSession.submit(playerId, input)
       │
       ▼
LocalMatchSession → Simulation.step(1/60, inputs)
       │
       ▼
GameSnapshot → GameRenderer / GameUI / Sound
```

`core/types.ts` 是共同协议。命令和快照只包含可序列化数据，没有 Three.js 对象、DOM 元素或方法。`PlayerAgent` 决定行为，`Simulation` 决定行为是否有效。真人、AI 都不能直接改生命、速度或地图。

## 命名约定

代码中每个概念只用一个标识符：放置的爆炸物一律叫 `bomb`（快照类型 `Bomb`、`systems/bombs.ts`、`BombLights`、`BombFinishes`），参战者一律叫 `player`（快照类型 `Player`）。`seat` 只表示匹配房间里的席位，席位可以为空。界面文案不受此约束，中文显示“炸药”“选手”。

文件名用 kebab-case，类型和类用 PascalCase，函数用 camelCase，模块级常量表用 UPPER_SNAKE。内容 ID 是字符串别名：`ItemId`、`SkillId`、`PerkId`、`MutationId`；`Consumable` 是可进入库存的 `ItemId`，`Equipment` 是 `"bomb" | Consumable`。签名中凡是表示 ID 的参数都使用这些别名。

## 输入协议

```ts
interface PlayerInput {
  moveX: number;
  moveZ: number;
  yaw: number;
  sprint?: boolean;
  jump?: boolean;
  equip?: Equipment; // 切换手持装备
  useEquipment?: boolean; // 主动作：部署炸药、挥刀、自用或投掷
  aimTarget?: Vec2; // 炸药部署格或投掷落点
  throwMode?: ThrowMode;
  meleeYaw?: number;
  plantAtFeet?: boolean; // 俯视期间在脚下放置炸药
  activateSkill?: SkillId;
  choosePerk?: PerkId; // 从当前候选中领取一张强化
  usePerk?: PerkId; // 发动已持有的主动强化
  resetTerrain?: boolean;
  buySkill?: SkillId; // 开局商店
  refundSkill?: SkillId;
}
```

字段名与模块钩子保持同一组动词：技能 `activate`，强化 `use`，装备 `onUse`。

## 事件

`GameSnapshot.events` 是按 `type` 区分的联合类型。所有事件都带 `id`、`at`（模拟秒）、`playerId`、`x`、`z`、`text`、`textEn`，其余字段随类型而定：

| `type` | 附加字段 |
| --- | --- |
| `bomb`、`blast`、`blast-contact`、`kill`、`level` | 无 |
| `equip` | `item: Equipment` |
| `equipment`、`melee`、`pickup` | `item: ItemId` |
| `cover-hit` | `item: ItemId`、`coverSurface` |
| `cover` | `item?: ItemId`（近战拆除时给出，爆破时省略） |
| `hit` | `item?: ItemId`、`zombie?: { id, level, outcome: "hurt" \| "killed" }` |
| `hurt` | `blocked: boolean` |
| `shield-end` | `item: ItemId`、`reason: "broken" \| "expired"` |
| `mutation` | `mutation: MutationId` |
| `perk`、`perk-use` | `perk: PerkId` |
| `skill` | `skill: SkillId` |

事件由 `systems/events.ts` 的 `emit(ctx, player, text, event, at?)` 写入，公共字段在此统一填充。界面、音频和渲染先用 `type` 收窄再读取附加字段。事件仍是普通可序列化对象。

## 模拟系统

`core/simulation.ts` 只负责建局和每个 tick 的阶段顺序；规则位于 `core/systems/`，均为接收 `SimContext`（快照、地图、种子随机数、ID 分配器、僵尸导演和服务端私有计数）的普通函数。

| 文件 | 职责 |
| --- | --- |
| `match.ts` | 倒计时、全场视角、地形重置、模块效果上下文、终局排名 |
| `progression.ts` | 积分与经验、强化候选、商店购买、强化与技能施放 |
| `movement.ts` | 移动、冲刺、跳跃、碰撞、踢炸药 |
| `equipment.ts` | 切换装备、投掷与自用道具、近战挥击 |
| `bombs.ts` | 放置、滑行、引爆与连锁、投掷物落地 |
| `combat.ts` | 爆炸伤害结算、护盾、受伤与淘汰、僵尸奖励与僵尸攻击 |
| `loot.ts` | 拆箱掉落与保底计数、僵尸掉落、拾取、场地补给 |
| `events.ts` | 事件写入与日志裁剪 |
| `context.ts` | `SimContext` 定义 |

阶段顺序、随机数抽取顺序和 ID 分配顺序共同构成确定性约定，集中写在 `Simulation.step` 中。

## 行为策略

所有控制器实现 `PlayerAgent`：

```ts
interface PlayerAgent {
  readonly playerId: string;
  decide(context: AgentContext): PlayerInput;
  reset?(): void;
  dispose?(): void;
}
```

`KeyboardAgent` 只负责把设备输入转成世界方向与动作；`BotAgent` 只负责策略。AI 当前采用“躲避危险 → 捡道具 → 靠近目标 → 炸开障碍”的优先级，放炸药前搜索退路。雷达干扰期间 AI 不使用对手坐标选目标，但仍保留近处危险预测，避免完全失去行动能力。

将来增加智能 AI 时，实现新策略并在 `session/create-session.ts` 替换对应的 `BotAgent` 即可。若模型推理是异步的，应在策略内部缓存最近有效决策，`decide` 返回缓存值；不要阻塞模拟循环。

## 接入联机

客户端只依赖 `MatchSession`：

```ts
interface MatchSession {
  submit(playerId: string, input: PlayerInput): void;
  advance(dt: number): void;
  getSnapshot(): Readonly<GameSnapshot>;
  getRenderSnapshot?(): Readonly<GameSnapshot>;
  restart(options: MatchOptions): void;
  dispose(): void;
}
```

主要替换点是 `session/create-session.ts`。新增 `RemoteMatchSession` 实现该接口，渲染、HUD、键盘行为无需依赖具体传输方式。

1. 服务端创建 `Simulation`，以固定 60Hz 更新。AI 在服务端通过同一 `PlayerAgent` 接口提交意图。
2. 客户端的 `submit` 发送输入意图；真实玩家身份由认证连接绑定，不信任客户端传来的玩家 ID。增加命令序列号、限频、去重、断线和超时处理。
3. 服务端验证输入数值、动作频率、技能冷却、道具选择、房间容量和对局状态。客户端不能上传权威位置或生命值。
4. 服务端按固定频率广播带 tick / revision 的快照；`RemoteMatchSession` 缓存最近快照，`getSnapshot` 返回该缓存。`advance` 可处理输入发送节流和插值时钟，不再推进权威模拟。
5. 渲染层增加位置插值；需要更灵敏的移动时，再增加客户端预测和服务端纠偏。
6. `restart` 发送重新准备/开局请求，不能直接重建服务端对局；UI 等待服务端确认。

本地的 `advance(0)` 不推进时间，只结算商店买卖和强化选择（`buySkill`、`refundSkill`、`choosePerk`），界面随即读取结果。远程实现应在 `submit` 中发送这些命令，收到服务端确认后再更新界面，并为网络延迟增加等待状态。选择强化不暂停对局；本地按 Esc 的暂停会停止整个模拟，多人局不应提供。

客户端 `getSnapshot()` 返回的是只读视图，调用方必须把它当作不可变数据。当前实现为避免每帧复制而返回内部引用；服务端和调试脚本可直接操作 `Simulation.state` 来构建场景，产品 UI 不应这样做。

## 内容模块

`src/modules/{skills,items,perks}/<id>/index.js` 是模块入口。各入口导入同目录的 `config.js`，分别通过 `defineSkill`、`defineItem`、`definePerk` 导出配置和行为。浏览器在启动时请求 `mods/manifest.json`，并行导入目录里的原生 ES 模块，全部加载完成后再初始化核心和界面。开发服务器扫描 `src/modules`，发布预览扫描 `dist/mods`，普通静态服务器使用磁盘上的清单。Node 模拟从文件系统发现相同入口。模拟、输入、AI 和 UI 读取同一份定义。

| 层 | 职责 |
| --- | --- |
| 内容模块 | 定义图标、说明、数值和候选权重，响应施放、拾取、拆箱、造成伤害等事件 |
| 权威模拟 | 验证输入、结算生命与积分、维护库存、碰撞和时间，按玩家持有的内容分发事件 |
| 展示与控制器 | 商店、图鉴、技能栏、装备栏从注册表生成。AI 可读取模块提供的优先级，预设购买路线与组合战术位于 BotAgent |
| 快照 | 保存模块 ID、持有层数所需的领取记录、库存、冷却和玩家私有数值。模块函数在本地注册表或服务端注册表中解析 |

每次属性求值先按购买顺序应用技能，再按首次领取顺序应用强化。同一强化在一次求值或事件分发中收到一次调用，并获得总层数。主动技能施放、强化领取、移动和伤害仍在权威模拟中执行。完整范例见 [README 的开发说明](../README.md#开发一个内容模块)，钩子定义见[开发接口](../src/core/module-api.ts)。

地图、Minecraft 皮肤和炸药涂装分别从 `modules/maps`、`modules/skins` 和 `modules/bomb-finishes` 发现。开发者接口在 `core/pack-api.ts`，地图生成、边界和出生区位于 `core/maps.ts`。材质和几何分别由 `MaterialLibrary` 和 `Models` 缓存，`Arena` 负责静态地图，`GameRenderer` 根据快照更新动态对象。

发布版中的 `mods/sdk.js` 为各分类提供稳定的导入路径，模块用相对 URL 读取自己的图片和模型。`mods/reindex.mjs` 可独立更新静态托管清单。详见 [Mod 安装说明](../src/modules/README.md)。

### 资源加载

首次启动时，HTML 加载页先于游戏脚本出现。渲染器准备大厅场景、角色贴图和炸药模型，首帧绘制后进入主页。确认阵容后，部署页展示本局地图布局，并等待角色和掉落模型准备完成再进入商店。`render/scene-assets.ts` 汇总 Three.js 的加载进度，角色 PNG 解码也在同一队列中。重复对局复用已经载入的资源。

## 时间与随机数

模拟使用固定步长和独立的种子随机数；不在规则中读取 `Date.now`、`Math.random` 或浏览器时间。局外用当前时间产生新地图种子。UI 动画使用真实时间，伤害、技能、倒计时使用模拟时间。本地暂停会停止整个权威模拟。

输入动作是边沿事件：`LocalMatchSession` 会在高刷新率帧之间保留动作，在固定模拟 tick 消费一次，避免丢键或在追帧时重复放炸药。

## 渲染参考

场景使用标准物理材质、albedo / roughness / bump 纹理、显式色彩空间、PMREM 环境反射、软阴影与 ACES 色调映射。材质加载位于 `src/render/materials.ts`，天空和环境光位于 `src/render/outdoor-lighting.ts`。

静态地图由 `StaticBatches` 合并为实例化批次，可破坏掩体保留实例槽位，销毁时只隐藏对应槽位；共享材质和几何由 `Models` 管理。`BombLights` 使用固定四灯池，避免点光源数量改变导致 PBR 程序反复编译。`DangerOverlays` 为每颗炸药提交一个实例化预警网格，图案表达攻击等级，颜色表达所属玩家。`LocalMatchSession.getRenderSnapshot` 只插值渲染副本，权威模拟保持 60Hz。后处理管线和测量记录见[性能说明](performance.md)。

## 数值与反馈

伤害、积分和阈值集中在 `core/combat.ts` 的 `COMBAT`，对局规则常量在 `core/content.ts` 的 `RULES`。玩家血量、攻击值和炸药放置时锁定的威力都是可序列化的权威状态。升级提示是非阻塞卡片托盘，数字键 1/2/3 快选，Tab 展开或收起，模拟持续运行。素材来源见 `public/assets/CREDITS.md`。

## 验证

仓库不附带测试套件。提交前运行 `npm run check`（类型检查、ESLint、Prettier）和 `npm run build`，玩法由试玩确认。

## 障碍物预设与共享材质

可摧毁障碍物集中定义在 `core/obstacles.ts`：每个预设一条 `defineObstacle`，包含模型、材质类别、高度和占格比例。地图通过 `obstacles: [{ use, weight }]` 引用预设或 `set:<标签>` 分组，`core/cover-layout.ts` 把它解析成每格稳定的外观，模拟和渲染读取同一份结果。

内置障碍物和装备模型由 `tools/model-forge` 生成为 GLB，只带几何、UV 和形如 `df:<名称>` 的材质名。`MaterialLibrary.applyPalette` 在加载时把这些名称换成 `assets/surfaces` 下的共享 PBR 材质，所以所有道具共用同一套贴图、同一贴图密度和同一批 GPU 纹理。玩家自建木箱使用 `built-crate` 预设，由 `Arena` 按快照里的 `builtCrates` 作为动态物体渲染，并贴上建造者角色的 `emblem`。
