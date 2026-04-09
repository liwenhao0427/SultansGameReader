# 苏丹的游戏本地剧情阅读器 — 需求与设计文档

## 项目目标

基于 Electron + React + @xyflow/react 实现的桌面端游戏资源阅读器，直接读取本地游戏配置文件和图片资源，以节点图 + 类视觉小说形式呈现游戏剧情结构。

---

## 技术栈

- Electron（本地文件访问、IPC 通信）
- React + Vite
- @xyflow/react（节点图画布）
- Zustand（状态管理）
- Node.js（主进程：文件解析、缓存管理）

---

## 核心模块

### 1. 配置文件解析器（`electron/parser/`）

游戏配置为自定义格式（非标准 JSON/JSON5），解析流程：

```
原始文件
  ↓ 1. 状态机剥离注释（保留注释内容作为元数据）
  ↓ 2. 移除尾随逗号
  ↓ 3. 自定义解析器处理重复 key（合并为数组）
  ↓ 4. 保留原始 key 名（不做字符替换）
  ↓ 写入缓存目录（JSON + 注释元数据）
```

**注释保留策略**：
- 行尾注释（`// 注释`）：附加到其所在 key 的 `_comment` 元数据字段
- 上方独立注释行（`// 注释`）：附加到紧随其后的 key 的 `_comment_above` 字段
- 块注释（`/* */`）：同上方注释处理
- 注释内容对 condition 中的计数器/开关字段尤为重要，是理解其语义的唯一来源

**重复 key 合并规则**：
已知需要合并为数组的 key：`rite`、`event_on`、`rite_end`、`card`、`loot`、`choose`

**缓存策略**：
- 解析结果写入 `cache/<type>/<id>.json`
- 同时记录原始文件路径和 mtime
- 启动时对比 mtime，按需重新解析
- 缓存文件包含额外字段 `_source_path`（原始文件路径）和 `_cached_at`（缓存时间）

**忽略的字段**（仪式坐标等 UI 布局字段，不影响剧情逻辑）：
- `cards_slot` 中的 `pos`、`x`、`y`、`width`、`height` 等坐标字段
- `mapping_id`（仪式模板映射，UI 用）
- `icon`（仪式图标，展示层处理）

---

### 2. 节点类型

| 类型 | ID 范围 | 目录 | 主要字段 |
|------|---------|------|---------|
| event | 53xxxxx | `event/` | `id`, `text`, `settlement`, `condition`, `on` |
| rite | 50xxxxx | `rite/` | `id`, `name`, `text`, `settlement`, `settlement_prior`, `settlement_extre` |
| loot | 60xxxxx | `loot/` | `id`, `name`, `item` |
| after_story | 20xxxxx | `after_story/` | `id`, `name`, `extra` |
| over | — | `over.json` | `id`, `name`, `text` |
| card | 20xxxxx | `cards.json` | `id`, `name`, `title`, `text`, `resource`, `tag` |
| upgrade | 33xxxxx | `upgrade.json` | `id`, `name`, `text`, `effect`, `condition` |
| dt | DT1-DT9 | `dt/` | `dialog_tree_id`, `Item` |

---

### 3. 节点关联（Edge）

节点间关联通过以下字段提取：

- `event_on` → 触发事件（event → event）
- `rite` → 关联仪式（event/rite → rite）
- `loot` → 关联战利品（event/rite → loot）
- `rite_end` → 仪式结束触发（rite → event）
- `card` → 关联卡牌（event/rite → card）
- after_story 的 `condition` 中的 `have.卡牌ID` → 关联卡牌

**Edge 数据结构**：
```json
{
  "source": "event:5300000",
  "target": "event:5300066",
  "conditionKey": "success.event_on",
  "conditionText": "确认后触发",
  "comment": "注释内容（来自配置文件注释）",
  "branchType": "success | failed | case:1 | default"
}
```

**点击 Edge**：弹出浮层展示条件文本 + 注释内容。

---

### 4. 条件系统（Condition Key 解析）

条件表达式编码在 key 名中，展示时需转义为人类可读文本：

| 原始 key | 展示文本 |
|---------|---------|
| `have.卡牌ID` | 拥有 [卡牌名] |
| `!have.卡牌ID` | 不拥有 [卡牌名] |
| `counter.ID>=` | 计数器 [ID注释] ≥ 值 |
| `counter.ID<` | 计数器 [ID注释] < 值 |
| `counter.ID=` | 计数器 [ID注释] = 值 |
| `counter+ID` | 计数器 [ID注释] +值 |
| `counter-ID` | 计数器 [ID注释] -值 |
| `table_have.表ID.字段` | 表 [表ID] 存在字段 [字段名] |
| `any` | 满足以下任意一项 |
| `global_counter.ID>=` | 全局计数器 [ID注释] ≥ 值 |

---

### 5. 计数器/开关管理（侧拉栏）

- 维护一个全局计数器/开关注册表（从所有配置文件的注释中提取）
- 侧拉栏展示所有已知计数器，显示其 ID、注释说明、当前模拟值
- 用户可手动修改模拟值，用于高亮"当前玩家状态下可见的分支"
- 计数器来源：配置文件中 `counter.XXXXXXX` 格式的 key，注释为其语义说明

---

### 6. 画布交互

**搜索面板**（左侧）：
- 全量索引（启动时构建，内存存储）
- 支持按关键字搜索 id、name、text
- 支持按类型过滤（event/rite/loot/after_story/over/card）
- 搜索结果可拖入画布作为节点

**画布规则**：
- 节点不可重复（用 `Set<nodeId>` 维护）
- 拖入节点时自动展示其直接关联节点（可配置展开深度）
- 关联节点数量超过阈值（默认 10）时，不自动展开，需在详情中手动触发
- 节点支持折叠/展开关联

**玩家状态高亮**：
- 用户可输入"已触发的事件 ID 列表"模拟玩家当前状态
- 根据计数器模拟值，高亮玩家"最后选择的分支" edge
- 其他分支 edge 降低透明度

---

### 7. 详情视图（类视觉小说）

点击节点后，右侧面板展示：

**Event 节点**：
- 标题（`text` 字段）
- 触发条件（`condition` 字段，转义展示）
- 每个 `settlement` 条目：
  - 条件（`condition`）
  - 提示文本（`tips_text`）
  - 交互类型：`confirm`（确认框）/ `option`（选项）/ `slide`（幻灯片）/ `prompt`（提示）
  - 成功/失败分支文本
- 关联图片（`tips_resource` 或 action 中的 `slide`）

**Rite 节点**：
- 名称、描述文本
- 卡位信息（`cards_slot`，忽略坐标，展示卡位条件和说明）
- `settlement_prior`（优先结算）、`settlement`（常规结算）、`settlement_extre`（额外结算）
- 每条结算的条件 + 结果文本 + 动作

**After Story 节点**：
- 角色名（`name`）+ 立绘（`pic` 字段对应图片）
- `extra` 列表，每条：
  - 条件（转义展示）
  - 结果文本（`result_text`）
  - 立绘（`pic`）

**图片展示**：
- 根据 `pic` 字段查找 `resource/Sprite/` 下的图片
- 查找顺序：`{pic}.png` → `{pic}.png.png`（双后缀兼容）
- 数字 ID 图片支持变体展示（`_1`、`_2` 等后缀）

---

### 8. 原始文件对比

节点详情中提供"查看原始文件"入口：
- 展示原始配置文件内容（高亮注释）
- 对比缓存版本与原始文件的差异（主要是注释剥离和重复 key 合并）
- 标注 `_source_path` 字段指向的原始文件路径

---

### 9. 游戏目录配置

- 首次启动引导用户选择游戏安装目录
- 配置存储在 Electron userData 目录
- 支持分别配置：游戏配置目录（`config/`）和图片资源目录（`resource/`）
- 支持使用本工作区的 `config/` 和 `resource/` 作为离线参考

---

## 开发顺序

1. **解析器模块**（Node.js，独立可测试）— 当前阶段
2. Electron 脚手架 + IPC 通信
3. 搜索面板 + 索引构建
4. XYFlow 画布 + 节点拖入
5. 详情视图 + 图片展示
6. 条件文本解析 + Edge 点击展示
7. 计数器侧拉栏 + 玩家状态高亮
