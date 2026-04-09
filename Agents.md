# 苏丹的游戏本地剧情阅读器 - 项目说明

## 项目概述

本项目是一个基于 Electron 的桌面端游戏剧情阅读器，用于读取《苏丹的游戏》（Sultan's Game）本地配置文件和图片资源，以节点图 + 类视觉小说形式呈现游戏剧情结构。

技术栈：Electron + React + Vite + @xyflow/react + Zustand

数据流：用户选择游戏目录 → Parser 读取 config/ → CacheManager 写入 cache/ → Renderer 通过 IPC 从 cache/ 读取。图片资源通过 AssetStudio CLI 提取到 resource/，Renderer 通过 Image_Resolver 解析路径后加载。

核心设计决策：
- 前端只依赖 `cache/` 和 `resource/` 两个目录，不直接读取游戏原始配置文件
- 解析器模块（commentStripper、gameConfigParser、cacheManager）已完成并通过 2934 个文件 100% 验证，作为已有资产直接集成
- 条件表达式保留原始 key 名（含 `!`、`>=`、`.` 等特殊字符），仅在展示层通过 Condition_Parser 转义为人类可读文本
- 图片查找需同时尝试 `.png` 和 `.png.png` 双后缀（AssetStudio 提取产物）

---

## 语言规范

所有代码注释、回复、文档均使用中文。

---

## 工作区目录说明

```
工作区根目录/
├── AssetStudio-net8.0-win/   # 游戏资源提取工具（只读，不可修改）
├── config/                   # 游戏配置文件副本（只读，开发参考用）
├── cache/                    # 解析后的缓存文件（由 CacheManager 生成）
├── resource/                 # 提取出的游戏图片资源（只读，不可修改）
├── sudans-game-reader/       # 参考项目：旧版 Web 端剧情阅读器（只读，不可修改）
├── sultan-reader/            # 本项目源码
│   ├── electron/             # Electron 主进程代码
│   │   ├── main.js           # 入口，注册 IPC handlers，管理 BrowserWindow
│   │   ├── preload.js        # contextBridge 暴露 IPC API 到 renderer
│   │   └── parser/           # 配置解析器模块（已完成）
│   │       ├── commentStripper.js   # 注释剥离（状态机实现）
│   │       ├── gameConfigParser.js  # 配置解析（重复 key 合并、注释内联）
│   │       ├── cacheManager.js      # 缓存管理（mtime 增量缓存）
│   │       └── test.js              # 解析器测试
│   ├── src/                  # React 渲染进程代码
│   │   ├── main.jsx          # React 入口
│   │   ├── App.jsx           # 路由：设置页 vs 主布局
│   │   ├── components/       # UI 组件
│   │   │   ├── SettingsPage.jsx     # 设置页
│   │   │   ├── MainLayout.jsx       # 三栏主布局
│   │   │   ├── SearchPanel.jsx      # 左侧搜索面板
│   │   │   ├── Canvas.jsx           # @xyflow/react 节点图画布
│   │   │   ├── DetailPanel.jsx      # 右侧详情面板（类型分发）
│   │   │   ├── CounterPanel.jsx     # 计数器/开关管理侧拉栏
│   │   │   ├── RawFileView.jsx      # 原始文件对比视图
│   │   │   ├── nodes/               # 自定义节点组件
│   │   │   │   ├── EventNode.jsx
│   │   │   │   ├── RiteNode.jsx
│   │   │   │   ├── LootNode.jsx
│   │   │   │   ├── AfterStoryNode.jsx
│   │   │   │   ├── CardNode.jsx
│   │   │   │   └── GenericNode.jsx  # Over/Upgrade/DT 通用节点
│   │   │   └── details/             # 详情子组件
│   │   │       ├── EventDetail.jsx
│   │   │       ├── RiteDetail.jsx
│   │   │       ├── AfterStoryDetail.jsx
│   │   │       ├── CardDetail.jsx
│   │   │       ├── LootDetail.jsx
│   │   │       ├── OverDetail.jsx
│   │   │       ├── UpgradeDetail.jsx
│   │   │       └── DTDetail.jsx
│   │   ├── stores/           # Zustand 状态管理
│   │   │   ├── useConfigStore.js    # 搜索索引、卡牌映射、计数器注册表
│   │   │   ├── useCanvasStore.js    # 画布节点/边状态
│   │   │   └── usePlayerStore.js    # 玩家模拟状态
│   │   └── services/         # 业务逻辑服务
│   │       ├── configLoader.js      # 通过 IPC 从 cache 加载数据
│   │       ├── imageResolver.js     # 图片路径解析
│   │       ├── edgeExtractor.js     # 关联边提取
│   │       ├── conditionParser.js   # 条件表达式 → 人类可读文本
│   │       └── conditionEvaluator.js # 条件求值（玩家状态模拟）
│   ├── index.html            # Vite 入口
│   ├── vite.config.js        # Vite 配置
│   └── package.json          # 项目依赖
└── Agents.md                 # 本文档
```

> **重要约束**：`AssetStudio-net8.0-win/`、`config/`、`resource/`、`sudans-game-reader/` 四个目录均为只读参考资料，开发过程中只允许查看，不允许修改。

---

## 架构设计

### 双进程架构

```
Electron Main Process          Renderer Process (React + Vite)
┌─────────────────────┐        ┌──────────────────────────────┐
│ main.js             │        │ App.jsx (路由)                │
│ ├── Parser Module   │  IPC   │ ├── SettingsPage             │
│ │   ├── comment-    │◄──────►│ └── MainLayout               │
│ │   │   Stripper    │        │     ├── SearchPanel (左)      │
│ │   ├── gameConfig- │        │     ├── Canvas (中)           │
│ │   │   Parser      │        │     ├── DetailPanel (右)      │
│ │   └── cache-      │        │     └── CounterPanel (侧拉)  │
│ │       Manager     │        │                               │
│ ├── IPC Handlers    │        │ Stores (Zustand)              │
│ ├── Settings Store  │        │ ├── useConfigStore            │
│ └── AssetStudio CLI │        │ ├── useCanvasStore            │
└─────────────────────┘        │ └── usePlayerStore            │
                               │                               │
                               │ Services                      │
                               │ ├── configLoader              │
                               │ ├── imageResolver              │
                               │ ├── edgeExtractor             │
                               │ ├── conditionParser           │
                               │ └── conditionEvaluator        │
                               └──────────────────────────────┘
```

### IPC 通道

所有文件系统操作封装在 Main Process 中，Renderer 无直接 fs 访问权限。通过 `preload.js` 的 `contextBridge` 暴露 `window.electronAPI` 对象。

| 通道组 | 通道名 | 说明 |
|--------|--------|------|
| config: | setGameDir | 设置游戏目录，验证路径有效性 |
| config: | rebuildCache | 增量重建缓存，带进度回调 |
| config: | clearCache | 清除缓存 |
| config: | readCache | 读取单个缓存文件 |
| config: | listCache | 列出某类型下所有缓存条目 |
| config: | buildIndex | 构建全量搜索索引 |
| asset: | setCliPath | 设置 AssetStudio CLI 路径 |
| asset: | extract | 执行资源提取 |
| asset: | resolveImage | 图片路径解析（4 步回退链） |
| file: | readRaw | 读取原始文件内容 |
| settings: | get / set | 用户设置持久化 |

### 状态管理

- **useConfigStore**: 搜索索引（Map<id, entry>）、卡牌名称映射表（供 conditionParser 解析 `have.卡牌ID`）、计数器注册表
- **useCanvasStore**: 画布节点/边状态、节点去重集合（Set<nodeId>）、当前选中节点
- **usePlayerStore**: 玩家模拟状态（已触发事件 Set、计数器模拟值 Map），持久化到 Electron userData

---

## 配置文件数据格式

游戏配置**不是标准 JSON，也不是 JSON5**，而是游戏策划团队自定义的格式。它在语法上接近 JSON5，但存在若干 JSON5 也不支持的特性。

### 格式特性

- 支持单行注释（`//`）和块注释（`/* */`）
- 支持尾随逗号
- **支持同一对象内的重复 key**（标准 JSON 和 JSON5 都不支持）
- key 中可包含特殊字符：`!`、`>=`、`<=`、`>`、`<`、`+`、`-`、`.` 等

### 典型数据结构示例

```json5
// event 示例
{
  "id": 5300000,
  "text": "开场介绍",  // 策划备注
  "settlement": [{
    "action": {
      "success": {
        "event_on": [5300300, 5300301],  // 数组形式
        "event_on": 5300066              // 重复 key！游戏引擎会合并处理
      }
    }
  }]
}

// after_story 示例
{
  "id": 2000001,
  "name": "主角",
  "extra": [{
    "key": "2000001_extra_1",
    "pic": "cards/yrl",
    "condition": {
      "counter.7000490>=": 1,   // key 中含 >= 和 .
      "!have.妻子": 1           // key 中含 ! 和 .
    },
    "result_text": "..."
  }]
}
```

### 条件系统

条件表达式编码在 key 名中：

| 原始 key 模式 | 含义 |
|---|---|
| `have.<卡牌ID>` | 拥有指定卡牌 |
| `!have.<卡牌ID>` | 不拥有指定卡牌 |
| `counter.<ID>>=` | 计数器 ≥ 某值 |
| `counter.<ID><` | 计数器 < 某值 |
| `counter+<ID>` | 计数器加法（action 中） |
| `counter-<ID>` | 计数器减法（action 中） |
| `table_have.<表ID>.<字段>` | 表中存在指定字段 |
| `any` | 满足其中任意一个条件 |
| `s<数字>.is` | 卡位是某卡牌 |
| `r<数字>:<属性>+<属性>>=` | 检定属性 ≥ 阈值 |

---

## 解析坑点

### 坑点一：重复 key（最核心问题）

同一对象内可出现多个同名 key，`JSON.parse()` 和 `JSON5.parse()` 都会静默丢弃前面的值。

**处理方式**：自定义解析器在词法层面收集重复 key，合并为数组。

**已知需要合并的 key**：`rite`、`event_on`、`rite_end`、`card`、`loot`、`choose`

### 坑点二：key 中含特殊字符

条件表达式直接编码在 key 名里。**本项目保留原始 key 名，不做字符替换**，在展示层通过 Condition_Parser 转义。

### 坑点三：注释中可能包含引号或特殊字符

使用状态机方式剥离注释（已在 `commentStripper.js` 中实现），不使用正则。

### 坑点四：尾随逗号

处理顺序：**先移除注释，再处理尾随逗号**。

### 坑点五：旧项目的预处理（本项目需要绕过）

旧项目 `sudans-game-reader/scripts/json5_parser.py` 做了不可逆转换（特殊字符替换为中文、稀有度数字转中文等），本项目**不应复现**这些转换。

### 坑点六：`.png.png` 双后缀图片

AssetStudio 提取产物可能产生双后缀。查找图片时需同时尝试：
```
resource/Sprite/{name}.png       ← 优先
resource/Sprite/{name}.png.png   ← 备选
resource/Texture2D/{name}.png    ← 再备选
resource/Texture2D/{name}.png.png ← 最后
```

### 推荐解析流程

```
原始文件 → 读取 UTF-8 → 状态机剥离注释（保留注释文本到 __c/__ca/__ci）
→ 移除尾随逗号 → 收集重复 key 合并为数组 → 保留原始 key 名 → 解析结果
```

---

## 已完成模块

### Parser 模块（`sultan-reader/electron/parser/`）

已完成并通过 2934 个文件 100% 验证：

- **commentStripper.js** — 状态机实现的注释剥离器，保留注释文本
- **gameConfigParser.js** — 配置解析器，处理重复 key 合并、注释内联（`__c`、`__ca`、`__ci` 字段后缀）
- **cacheManager.js** — 基于 mtime 的增量缓存管理器，写入元数据（`_source_path`、`_cached_at`、`_source_mtime`、`_parse_error`）

这些模块作为已有资产直接集成，不需要重新创建。

---

## 缓存数据结构

所有缓存文件共享元数据前缀：

```javascript
{
  _source_path: "原始文件绝对路径",
  _cached_at: 1234567890,    // 缓存时间戳 (ms)
  _source_mtime: 1234567890, // 原始文件 mtime (ms)
  _parse_error: null         // 解析错误信息
}
```

### 缓存目录结构

| 目录 | ID 格式 | 说明 |
|------|---------|------|
| cache/event/ | 53xxxxx | 游戏事件（1337 个文件） |
| cache/rite/ | 50xxxxx | 仪式配置 |
| cache/loot/ | 60xxxxx | 战利品配置（147 个文件） |
| cache/after_story/ | 20xxxxx | 后日谈剧情 |
| cache/dt/ | DT1~DT9 | 对话树 |
| cache/init/ | 0, 1 | 初始化配置 |
| cache/wizard/ | — | 向导配置 |
| cache/rite_template/ | — | 仪式模板 |
| cache/single/ | — | 大型单文件（cards.json、over.json、upgrade.json 等） |

---

## 节点类型与画布

8 种节点类型：event、rite、loot、after_story、card、over、upgrade、dt

### 节点 ID 格式

`{type}:{id}`，例如 `event:5300000`

### Edge 提取规则

| 源字段 | 目标类型 | 说明 |
|--------|---------|------|
| `event_on` | event | 触发事件 |
| `event_off` | event | 关闭事件 |
| `rite` | rite | 关联仪式 |
| `loot` | loot | 关联战利品 |
| `rite_end` | event | 仪式结束触发 |
| `card` | card | 关联卡牌 |
| `link_card` | card | 升级关联卡牌 |

Edge 颜色：绿色 = success 分支，红色 = failed 分支，灰色 = 默认

自动展开规则：关联数 ≤ 10 自动展开，> 10 折叠状态（手动展开）

Edge 提取需递归遍历 settlement 数组中的 `action.success`、`action.failed`、以及嵌套的 condition 对象。branchType 由所在路径决定。

---

## 图片资源与配置的对应关系

配置中的 `pic` 字段指向图片路径：
- `"pic": "cards/2000001"` → `resource/Sprite/2000001.png`
- `"pic": "cards/yrl"` → `resource/Sprite/yrl.png`
- 数字 ID 图片对应角色立绘，部分角色有多张变体（`_1`、`_2` 后缀）
- 查找时需同时尝试 `.png` 和 `.png.png` 两种后缀

---

## 各只读目录说明

### AssetStudio-net8.0-win/
- 用途：从游戏安装包提取原始资源
- 提供 GUI（`AssetStudio.GUI.exe`）和 CLI（`AssetStudio.CLI.exe`）两种方式
- 需要 .NET 8.0 运行时

### config/
- 游戏配置文件的本地副本，供开发时离线参考
- 生产环境应从游戏真实安装目录读取（`<gamePath>/Sultan's Game_Data/StreamingAssets/config`）
- 主要子目录：after_story/、event/、loot/、rite/、rite_template/、dt/、wizard/、init/
- 单文件：cards.json、quest.json、variable.json、tag.json、upgrade.json、over.json、credits.json

### resource/
- 已提取的游戏图片资源
- `Sprite/` — UI 精灵图（角色立绘、图标、背景等）
- `Texture2D/` — 原始纹理贴图
- 命名规律：数字 ID 对应角色/事件 ID，`_bg`/`_fg` 后缀表示背景/前景层

### sudans-game-reader/
- 旧版 Web 端剧情阅读器（Vue 2 + Webpack + Element Plus）
- 参考价值：`src/services/eventService.js`（数据解析逻辑）、`src/components/`（展示组件）
- 注意：`src/assets/config/` 是经过预处理的版本，key 名已被修改，**不能作为格式参考**

---

## 开发注意事项

- 配置文件**不是 JSON5**，是游戏自定义格式，详见"解析坑点"章节
- 部分配置文件体积较大（如 `after_story/2000001.json` 超过 1400 行），注意性能
- 游戏真实配置目录路径需要在应用中可配置，不能硬编码
- 大型单文件（cards.json ~27000 行）缓存到 `cache/single/` 下
- 搜索索引构建需在 5 秒内完成（约 2934 个缓存文件）
- 超过 1000 行的详情内容使用虚拟化或分页渲染
