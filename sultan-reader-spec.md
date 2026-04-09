# 苏丹的游戏 · 本地剧情阅读器 — 需求文档

## 一、项目定位

桌面端游戏剧情阅读器，读取本地缓存的游戏配置和图片资源，以**节点图 + 类视觉小说**形式呈现游戏剧情结构。

核心价值：让玩家/策划能快速检索任意事件、仪式、结局、后日谈等，以可视化节点图理解剧情分支关系，点击节点后以视觉小说形式阅读剧情文本和角色立绘。

---

## 二、技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 桌面框架 | Electron | 本地文件访问、IPC 通信 |
| 前端 | React + Vite | 渲染层 |
| 节点图 | @xyflow/react | 画布、节点、边 |
| 状态管理 | Zustand | 轻量 |
| 解析器 | Node.js（已完成） | 主进程运行 |

---

## 三、数据流架构

```
用户选择游戏目录 → 解析器读取 config/ → 写入 cache/ → 前端从 cache/ 读取
用户提取资源     → AssetStudio CLI → 写入 resource/ → 前端从 resource/ 读取
```

**关键设计：前端只依赖 `cache/` 和 `resource/` 两个目录**，不直接读取游戏原始文件。

### 3.1 配置解析（已完成）

解析器模块位于 `sultan-reader/electron/parser/`，已通过 2934 个文件 100% 验证。

- 支持游戏自定义格式（注释、尾随逗号、重复 key）
- 注释内联到解析结果：`__c`（行尾）、`__ca`（上方）、`__ci`（标量数组元素）
- 对象数组元素的注释直接写入元素的 `__c` / `__ca` 字段
- 基于 mtime 的增量缓存

### 3.2 资源提取（用户手动触发）

用户需要：
1. 下载 AssetStudio（工作区已包含 `AssetStudio-net8.0-win/`）
2. 在应用设置中指定 `AssetStudio.CLI.exe` 路径和游戏路径
3. 点击"提取资源"按钮，应用自动执行：

```bash
AssetStudio.CLI.exe "<gamePath>\Sultan's Game_Data" "<resourceDir>" --game Normal --types Sprite:Both --group_assets ByType --image_format Png
```

```bash
AssetStudio.CLI.exe "<gamePath>\Sultan's Game_Data" "<resourceDir>" --game Normal --types Texture2D --group_assets ByType --image_format Png
```

提取结果写入 `resource/Sprite/` 和 `resource/Texture2D/`。

### 3.3 图片查找规则

配置中 `pic` 字段 → 图片路径映射：
- `"pic": "cards/2000001"` → 查找 `resource/Sprite/2000001.png`
- 备选：`resource/Sprite/2000001.png.png`（AssetStudio 双后缀产物）
- 再备选：`resource/Texture2D/` 下同名文件

封装为统一的 `resolveImage(pic)` 函数。

---

## 四、数据模型

### 4.1 节点类型

| 类型 | ID 特征 | 缓存目录 | 关键字段 |
|---|---|---|---|
| event | 53xxxxx | `cache/event/` | id, text, settlement, condition, on |
| rite | 50xxxxx | `cache/rite/` | id, name, text, settlement, settlement_prior, settlement_extre, cards_slot |
| loot | 60xxxxx | `cache/loot/` | id, name, type, item |
| after_story | 20xxxxx | `cache/after_story/` | id, name, extra |
| card | 20xxxxx | `cache/single/cards.json` 内 | id, name, title, text, resource, tag, rare |
| over | — | `cache/single/over.json` 内 | 按 key 索引 |
| upgrade | 33xxxxx | `cache/single/upgrade.json` 内 | id, name, text, effect, condition, link_card |
| dt | DT1~DT9 | `cache/dt/` | dialog_tree_id, Item（对话树） |

### 4.2 节点间关联（Edge 提取规则）

从配置数据中提取以下字段作为边：

| 字段 | 方向 | 说明 |
|---|---|---|
| `event_on` | 当前 → event | 触发事件 |
| `event_off` | 当前 → event | 关闭事件 |
| `rite` | 当前 → rite | 关联仪式 |
| `loot` | 当前 → loot | 关联战利品 |
| `rite_end` | rite → event | 仪式结束触发 |
| `card` | 当前 → card | 关联卡牌 |
| `confirm.icon` / `slide` | — | 关联图片资源（非节点边） |
| `link_card` | upgrade → card | 升级关联卡牌 |

Edge 数据结构：
```json
{
  "source": "event:5300000",
  "target": "event:5300066",
  "path": "settlement[0].action.success.event_on",
  "branchType": "success",
  "conditionText": "确认后触发（注释内容）"
}
```

### 4.3 条件系统

条件表达式编码在 key 名中，展示时需解析为人类可读文本：

| 原始 key 模式 | 展示 |
|---|---|
| `have.卡牌ID` | 拥有 [卡牌名] |
| `!have.卡牌ID` | 不拥有 [卡牌名] |
| `counter.ID>=` | 计数器 [ID注释] ≥ 值 |
| `counter.ID<` | 计数器 [ID注释] < 值 |
| `counter.ID=` | 计数器 [ID注释] = 值 |
| `counter+ID` | 计数器 [ID注释] +值（action） |
| `counter-ID` | 计数器 [ID注释] -值（action） |
| `table_have.表ID.字段` | 表 [表ID] 存在 [字段] |
| `any` | 满足任意一项 |
| `s数字.is` | 卡位 [数字] 是 [卡牌名] |
| `r数字:属性+属性>=` | 检定 [属性] ≥ [阈值] |

注释（`__c` 字段）是理解计数器/开关语义的唯一来源，展示时优先使用注释文本。

---

## 五、功能模块

### 5.1 设置页

- **游戏目录**：用户选择游戏安装根目录（如 `D:\Steam\steamapps\common\Sultan's Game`），记忆到 Electron userData
- **AssetStudio 路径**：用户指定 `AssetStudio.CLI.exe` 位置
- **资源目录**：默认 `<appData>/resource/`，可自定义
- **缓存目录**：默认 `<appData>/cache/`，可自定义
- **操作按钮**：
  - "更新配置缓存"：从游戏目录读取 config，重新解析写入 cache
  - "提取游戏资源"：调用 AssetStudio CLI 提取 Sprite + Texture2D
  - "清除缓存"：删除 cache 目录
- **资源提取教程**：内嵌简要说明，告知用户需要 .NET 8.0 运行时

### 5.2 搜索面板（左侧栏）

- 启动时从 cache 目录构建全量内存索引（id → { type, name, text }）
- 搜索框：按关键字模糊匹配 id、name、text
- 类型过滤：event / rite / loot / after_story / over / card / upgrade / dt
- 搜索结果列表：显示 id、名称、类型标签
- **拖拽**：搜索结果可拖入画布作为节点

### 5.3 节点图画布（中央）

基于 @xyflow/react：

- **节点外观**：按类型着色，显示 id + name/text 摘要
- **节点去重**：`Set<nodeId>` 维护，同一节点不可重复添加
- **自动展开关联**：拖入节点后自动加载其直接关联节点
  - 关联数量 ≤ 10：自动展开
  - 关联数量 > 10：折叠，在详情面板中手动展开
- **Edge 样式**：
  - success 分支：绿色
  - failed 分支：红色
  - 默认/其他：灰色
  - 点击 Edge → 弹出浮层展示条件文本 + 注释
- **布局**：自动布局（dagre 或 elkjs），支持手动拖拽调整

### 5.4 详情面板（右侧栏）

点击节点后展示，类视觉小说风格：

**Event 节点**：
- 标题（text 字段 + `__c` 注释）
- 触发条件（condition，转义为可读文本）
- 每个 settlement 条目：
  - 条件 + 注释
  - 交互类型标识：confirm / option / slide / prompt
  - 结果文本（result_text / tips_text）
  - success / failed 分支
- 关联图片（slide、icon 字段）

**Rite 节点**：
- 名称、描述
- settlement_prior → settlement → settlement_extre 三段结算
- 每段的条件 + 结果文本 + 动作

**After Story 节点**：
- 角色名 + 立绘（pic 字段 → resolveImage）
- extra 列表，每条：条件（转义）+ 结果文本 + 立绘
- 上方注释（`__ca`）作为章节标题（如"结局新日之书"）

**Card 节点**：
- 名称、称号、描述
- 立绘（resource 字段）
- 标签（tag 对象）
- 稀有度

**Loot 节点**：
- 名称、类型
- 掉落物列表（item 数组）

**通用**：
- "查看原始文件"按钮：展示原始配置文件内容（从 `_source_path` 读取）
- 对比视图：高亮注释、标注重复 key 合并位置

### 5.5 计数器/开关管理（侧拉栏）

- 从所有缓存文件中提取 `counter.XXXXXXX` 格式的 key，建立计数器注册表
- 每个计数器：ID、注释说明（来自 `__c`）、当前模拟值（默认 0）
- 用户可手动修改模拟值
- 用途：
  - 根据模拟值判断哪些 condition 满足，高亮对应的 Edge 和 settlement
  - "玩家当前分支"高亮：满足条件的 Edge 高亮，不满足的降低透明度
- 持久化到 localStorage 或 Electron userData

### 5.6 玩家状态模拟

- 用户可标记"已触发的事件 ID"
- 结合计数器模拟值，计算当前状态下：
  - 哪些 settlement 条件满足 → 高亮对应分支
  - 哪些 after_story extra 可见 → 高亮对应条目
- 高亮的 Edge 作为"玩家最后选择的路径"默认展示

---

## 六、目录结构

```
sultan-reader/
├── electron/
│   ├── main.js                    # Electron 主进程
│   ├── preload.js                 # 预加载脚本（暴露 IPC API）
│   └── parser/                    # 配置解析器（已完成）
│       ├── commentStripper.js
│       ├── gameConfigParser.js
│       ├── cacheManager.js
│       └── test.js
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   ├── stores/                    # Zustand stores
│   │   ├── useConfigStore.js      # 配置数据 + 索引
│   │   ├── useCanvasStore.js      # 画布节点/边状态
│   │   └── usePlayerStore.js      # 玩家状态模拟
│   ├── components/
│   │   ├── Canvas.jsx             # XYFlow 画布
│   │   ├── SearchPanel.jsx        # 搜索面板
│   │   ├── DetailPanel.jsx        # 详情面板（视觉小说）
│   │   ├── CounterPanel.jsx       # 计数器管理
│   │   ├── SettingsPage.jsx       # 设置页
│   │   └── nodes/                 # 自定义节点组件
│   │       ├── EventNode.jsx
│   │       ├── RiteNode.jsx
│   │       ├── LootNode.jsx
│   │       ├── AfterStoryNode.jsx
│   │       ├── CardNode.jsx
│   │       └── OverNode.jsx
│   ├── services/
│   │   ├── configLoader.js        # 从 cache 加载数据
│   │   ├── imageResolver.js       # 图片路径解析
│   │   ├── edgeExtractor.js       # 从节点数据提取关联边
│   │   ├── conditionParser.js     # 条件 key → 可读文本
│   │   └── assetExtractor.js      # 调用 AssetStudio CLI
│   └── styles/
├── cache/                         # 解析缓存（gitignore）
├── resource/                      # 提取的图片资源（gitignore）
└── package.json
```

---

## 七、IPC 接口设计

主进程（Electron）暴露给渲染进程的接口：

| 通道 | 方向 | 参数 | 返回 | 说明 |
|---|---|---|---|---|
| `config:setGameDir` | render→main | gamePath | { configDir, success } | 设置游戏目录 |
| `config:rebuildCache` | render→main | — | { total, errors } | 重新解析全部配置 |
| `config:clearCache` | render→main | type? | { success } | 清除缓存 |
| `config:readCache` | render→main | type, id | data | 读取单个缓存文件 |
| `config:listCache` | render→main | type | [{ id, name, text }] | 列出某类型所有缓存 |
| `config:buildIndex` | render→main | — | [{ id, type, name, text }] | 构建全量搜索索引 |
| `asset:setCliPath` | render→main | cliPath | { success } | 设置 AssetStudio CLI 路径 |
| `asset:extract` | render→main | { gamePath, outputDir, types } | { success, log } | 执行资源提取 |
| `asset:resolveImage` | render→main | pic | filePath \| null | 解析图片路径 |
| `file:readRaw` | render→main | filePath | string | 读取原始文件内容（对比用） |
| `settings:get` | render→main | key | value | 读取持久化设置 |
| `settings:set` | render→main | key, value | — | 写入持久化设置 |

---

## 八、开发顺序

1. **Electron 脚手架 + IPC 通信**：主进程集成解析器，暴露 IPC 接口
2. **设置页**：游戏目录选择、AssetStudio 配置、缓存/资源管理按钮
3. **搜索面板 + 索引构建**：从 cache 构建索引，搜索 + 拖拽
4. **XYFlow 画布**：节点渲染、自动展开关联、Edge 样式
5. **详情面板**：视觉小说式展示、图片加载、条件文本解析
6. **计数器管理 + 玩家状态高亮**
7. **资源提取集成**：AssetStudio CLI 调用、进度展示
8. **原始文件对比视图**

---

## 九、约束与注意事项

- `config/`、`resource/`、`AssetStudio-net8.0-win/`、`sudans-game-reader/` 均为只读参考，不可修改
- 配置文件不是标准 JSON，解析器已处理所有已知坑点（见 Agents.md）
- 图片查找需同时尝试 `.png` 和 `.png.png` 双后缀
- cards.json 约 27000 行，over.json、upgrade.json 等为单文件大对象，缓存在 `cache/single/`
- 部分配置文件超过 1000 行（如 after_story/2000001.json 1407 行、rite/5000001.json 1224 行），前端渲染详情时注意性能
- 游戏真实配置路径：`<gamePath>\Sultan's Game_Data\StreamingAssets\config`
- 游戏真实资源路径：`<gamePath>\Sultan's Game_Data`（AssetStudio 输入路径）
