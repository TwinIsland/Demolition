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

`KeyboardAgent` 只负责把设备输入转成世界方向与动作；`BotAgent` 只负责策略。AI 当前采用“躲避危险 → 捡道具 → 靠近目标 → 炸开障碍”的优先级，放水泡前搜索退路。雷达干扰期间 AI 不使用对手坐标选目标，但仍保留近处危险预测，避免完全失去行动能力。

将来增加智能 AI 时，实现新策略并在 `session/create-session.ts` 替换对应的 `BotAgent` 即可。若模型推理是异步的，应在策略内部缓存最近有效决策，`decide` 返回缓存值；不要阻塞模拟循环。

## 接入联机

客户端只依赖 `MatchSession`：

```ts
interface MatchSession {
  submit(playerId: string, input: PlayerInput): void;
  advance(dt: number): void;
  getSnapshot(): Readonly<GameSnapshot>;
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

当前本地 `advance(0)` 用于暂停期间处理升级选择；远程实现应在 `submit` 中发送升级命令，收到服务端确认后再清除选择界面。多人局不应因为一名玩家打开菜单或升级而暂停：应提供限时选卡或移动中选卡，替换 `main.ts` 的本地暂停策略。当前 UI 使用的是本地即时确认流程，需要为网络延迟增加等待状态。

客户端 `getSnapshot()` 返回的是只读视图，调用方必须把它当作不可变数据。当前实现为避免每帧复制而返回内部引用；服务端和测试可直接操作 `Simulation.state` 来构建场景，产品 UI 不应这样做。

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

输入动作是边沿事件：`LocalMatchSession` 会在高刷新率帧之间保留动作，在固定模拟 tick 消费一次，避免丢键或在追帧时重复放水泡。

## 渲染参考

场景使用标准物理材质、albedo / roughness / bump 纹理、显式色彩空间、PMREM 环境反射、软阴影与 ACES 色调映射。材质加载位于 `src/render/materials.ts`，天空和环境光位于 `src/render/outdoor-lighting.ts`。

MVP 使用共享材质和几何，地图格子仍为独立 mesh。更大地图可把地板、石墙等静态重复结构改为 `InstancedMesh`，再按性能分析决定是否加入后处理或更复杂的材质。

## 0.2 战斗反馈更新

升级提示已改为非阻塞卡片托盘，数字键 1/2/3 快选，Tab 展开或收起强化卡，模拟持续运行。命中敌人奖励 2 经验，自伤和护盾吸收不奖励；击杀另奖励 4 经验。音频已替换为下载文件，材质和角色采用下载资源；来源详见 public/assets/CREDITS.md。上文关于升级暂停的描述仅适用于初版。

## 性能与血量版本

静态地图使用 StaticBatches，木箱格保留实例槽位，销毁时只隐藏对应槽位；共享材质和几何仍由 Models 管理。炸药光源使用固定四灯池，避免点光源数量改变导致 PBR 程序反复编译。DangerOverlays 每颗炸药只提交一个实例化预警网格，图案表达攻击等级，颜色表达玩家。LocalMatchSession.getRenderSnapshot 只插值渲染副本，权威模拟仍保持 60Hz。伤害、积分和阈值见 core/combat.ts，玩家血量与攻击值、炸药放置时的威力均为可序列化权威状态。上文的三点生命/经验数值属于旧版本。
