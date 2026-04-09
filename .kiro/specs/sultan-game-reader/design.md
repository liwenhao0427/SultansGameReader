# Design Document: Sultan Game Reader

## Overview

苏丹的游戏本地剧情阅读器是一个 Electron 桌面应用，用于读取游戏本地配置文件和图片资源，以节点图 + 类视觉小说形式呈现游戏剧情结构。

应用采用经典的 Electron 双进程架构：Main Process 负责文件系统访问、配置解析、IPC 通信；Renderer Process 基于 React + Vite 构建 UI，使用 @xyflow/react 渲染节点图画布，Zustand 管理全局状态。

数据流为单向管道：用户选择游戏目录 → Parser 读取 config/ → CacheManager 写入 cache/ → Renderer 通过 IPC 从 cache/ 读取。图片资源通过 AssetStudio CLI 提取到 resource/ 目录，Renderer 通过 Image_Resolver 解析路径后加载。

核心设计决策：
- 前端只依赖 `cache/` 和 `resource/` 两个目录，不直接读取游戏原始配置文件
- 解析器模块（commentStripper、gameConfigParser、cacheManager）已完成并通过 2934 个文件 100% 验证，作为已有资产直接集成
- 条件表达式保留原始 key 名（含 `!`、`>=`、`.` 等特殊字符），仅在展示层通过 Condition_Parser 转义为人类可读文本
- 图片查找需同时尝试 `.png` 和 `.png.png` 双后缀（AssetStudio 提取产物）
- **本地图片通过自定义协议加载**：注册 `sultan-asset://` 协议，避免关闭 webSecurity 的安全风险
- **搜索逻辑在 Main Process 执行**：避免通过 IPC 传输全量索引数据导致的序列化性能瓶颈
- **自动展开使用 Visited Set 防循环**：游戏事件网络存在循环引用，必须严格拦截已访问节点
- **缓存包含解析器版本号**：`_parser_version` 字段确保解析逻辑升级后自动失效旧缓存
- **AssetStudio CLI 使用数组参数调用**：避免路径含空格/特殊字符时的命令行断裂问题

## Architecture

```mermaid
graph TB
    subgraph Electron Main Process
        M[main.js] --> P[Parser Module]
        M --> CM[CacheManager]
        M --> IPC[IPC Handlers]
        M --> Settings[Settings Store<br/>electron-store]
        P --> CS[commentStripper.js]
        P --> GCP[gameConfigParser.js]
    end

    subgraph Preload
        PL[preload.js<br/>contextBridge API]
    end

    subgraph Renderer Process - React + Vite
        App[App.jsx<br/>Router] --> SP[SettingsPage]
        App --> MainLayout[MainLayout]
        MainLayout --> Search[SearchPanel]
        MainLayout --> Canvas[Canvas<br/>@xyflow/react]
        MainLayout --> Detail[DetailPanel]
        MainLayout --> Counter[CounterPanel]

        subgraph Zustand Stores
            CS2[useConfigStore]
            CAS[useCanvasStore]
            PS[usePlayerStore]
        end

        subgraph Services
            CL[configLoader]
            IR[imageResolver]
            EE[edgeExtractor]
            CP[conditionParser]
            AE[assetExtractor]
        end
    end

    IPC <-->|contextBridge| PL
    PL <-->|window.electronAPI| App
    CM -->|read/write| Cache[(cache/)]
    M -->|spawn| AS[AssetStudio CLI]
    AS -->|extract| Res[(resource/)]
    IR -->|resolve| Res
    CL -->|IPC read| Cache
```

### 本地图片加载：自定义协议方案

Electron 默认开启 `webSecurity`，Renderer 进程中 `<img src="C:/...">` 会被拦截（`Not allowed to load local resource`）。关闭 `webSecurity` 是危险做法。

采用自定义协议（Custom Protocol）方案：

```javascript
// main.js 中注册协议
const { protocol } = require('electron');

protocol.handle('sultan-asset', (request) => {
  // sultan-asset://Sprite/2000001.png → resource/Sprite/2000001.png
  const relativePath = decodeURIComponent(request.url.replace('sultan-asset://', ''));
  const fullPath = path.join(resourceDir, relativePath);
  return net.fetch(`file://${fullPath}`);
});
```

前端使用 `sultan-asset://Sprite/2000001.png` 作为 `<img src>`，主进程拦截并返回本地文件流。性能优于 Base64 IPC 传输方案，且无安全风险。

`asset:resolveImage` IPC handler 返回的路径格式改为 `sultan-asset://` 协议 URL，而非本地绝对路径。

### 搜索架构：Main Process 侧搜索

为避免通过 IPC 传输全量索引数据（cards.json 27000+ 行）导致的结构化克隆性能瓶颈：

- 搜索索引的构建和模糊匹配逻辑在 Main Process 中完成
- Renderer 通过 `config:search` IPC 通道发送搜索关键字和类型过滤条件
- Main Process 返回匹配的结果摘要（通常几十条），而非全量数据
- 卡牌名称映射表（供 conditionParser 使用）精简为 `cards_lite`（仅 id → name），在 Parser 写入缓存时同步生成

新增 IPC 通道：
- `config:search(query: string, types?: string[])` → `Array<{ id, type, name, text }>` （最多返回 100 条）

原 `config:buildIndex` 通道保留但改为仅返回统计信息（各类型数量），不再传输全量数据。

### 进程间通信设计

Main Process 通过 `ipcMain.handle` 注册异步 IPC handler，Renderer 通过 preload 暴露的 `window.electronAPI` 对象调用。所有文件系统操作封装在 Main Process 中，Renderer 无直接 fs 访问权限。

IPC 通道分为五组：
1. **config:** — 配置解析与缓存管理（setGameDir, rebuildCache, clearCache, readCache, listCache, buildIndex, search）
2. **asset:** — 资源提取与图片解析（setCliPath, extract, resolveImage）
3. **file:** — 原始文件读取（readRaw）
4. **settings:** — 用户设置持久化（get, set）
5. **sultan-asset://** — 自定义协议，Renderer 直接通过 URL 加载本地图片（非 IPC，protocol handler）

### 状态管理架构

```mermaid
graph LR
    subgraph useConfigStore
        Index[searchIndex<br/>Map&lt;id, entry&gt;]
        Cards[cardsMap<br/>Map&lt;id, card&gt;]
        Counters[counterRegistry<br/>Map&lt;id, counter&gt;]
    end

    subgraph useCanvasStore
        Nodes[nodes<br/>XYFlow Node[]]
        Edges[edges<br/>XYFlow Edge[]]
        NodeSet[nodeIdSet<br/>Set&lt;string&gt;]
        Selected[selectedNode]
    end

    subgraph usePlayerStore
        Triggered[triggeredEvents<br/>Set&lt;id&gt;]
        CounterVals[counterValues<br/>Map&lt;id, number&gt;]
    end
```

- **useConfigStore**: 管理卡牌名称精简映射表（cards_lite，供 conditionParser 解析 `have.卡牌ID`）、计数器注册表。搜索索引不再存储在前端，搜索请求通过 IPC 发送到 Main Process
- **useCanvasStore**: 管理画布节点/边状态、节点去重集合（Visited Set，同时用于防止自动展开时的循环引用）、当前选中节点
- **usePlayerStore**: 管理玩家模拟状态（已触发事件、计数器模拟值），持久化到 Electron userData

## Components and Interfaces

### Main Process 模块

| 模块 | 职责 |
|---|---|
| `electron/main.js` | Electron 入口，注册 IPC handlers，管理 BrowserWindow |
| `electron/preload.js` | contextBridge 暴露 IPC API 到 renderer |
| `electron/parser/commentStripper.js` | 注释剥离（已完成） |
| `electron/parser/gameConfigParser.js` | 配置解析（已完成） |
| `electron/parser/cacheManager.js` | 缓存管理（已完成） |

### IPC 接口定义

```typescript
// preload.js 暴露的 API 类型定义（仅作文档参考，实际为 JS）
interface ElectronAPI {
  // 配置管理
  configSetGameDir(gamePath: string): Promise<{ configDir: string; success: boolean }>
  configRebuildCache(onProgress?: (current: number, total: number) => void): Promise<{ total: number; errors: string[] }>
  configClearCache(type?: string): Promise<{ success: boolean }>
  configReadCache(type: string, id: string): Promise<object>
  configListCache(type: string): Promise<Array<{ id: string; name?: string; text?: string }>>
  configBuildIndex(): Promise<{ counts: Record<string, number> }>  // 仅返回统计信息
  configSearch(query: string, types?: string[]): Promise<Array<{ id: string; type: string; name: string; text: string }>>  // Main Process 侧搜索
  configGetCardsLite(): Promise<Record<string, string>>  // id → name 精简映射

  // 资源管理
  assetSetCliPath(cliPath: string): Promise<{ success: boolean }>
  assetExtract(params: { gamePath: string; outputDir: string }): Promise<{ success: boolean; log: string }>
  assetResolveImage(pic: string): Promise<string | null>  // 返回 sultan-asset:// URL 或 null
  assetCheckDotnet(): Promise<{ available: boolean; version?: string }>  // .NET 运行时探测

  // 文件读取
  fileReadRaw(filePath: string): Promise<string>

  // 设置
  settingsGet(key: string): Promise<any>
  settingsSet(key: string, value: any): Promise<void>
}
```

### Renderer 组件

| 组件 | 职责 |
|---|---|
| `App.jsx` | 路由：设置页 vs 主布局 |
| `SettingsPage.jsx` | 游戏目录、AssetStudio 路径、缓存/资源管理 |
| `SearchPanel.jsx` | 左侧搜索面板，关键字搜索 + 类型过滤 + 拖拽 |
| `Canvas.jsx` | @xyflow/react 画布，节点渲染、Edge 样式、自动布局 |
| `DetailPanel.jsx` | 右侧详情面板，根据节点类型分发到子组件 |
| `CounterPanel.jsx` | 计数器/开关管理侧拉栏 |
| `nodes/EventNode.jsx` | Event 类型自定义节点 |
| `nodes/RiteNode.jsx` | Rite 类型自定义节点 |
| `nodes/LootNode.jsx` | Loot 类型自定义节点 |
| `nodes/AfterStoryNode.jsx` | AfterStory 类型自定义节点 |
| `nodes/CardNode.jsx` | Card 类型自定义节点 |
| `nodes/GenericNode.jsx` | Over/Upgrade/DT 通用节点 |

### Service 模块

| 模块 | 职责 |
|---|---|
| `services/configLoader.js` | 通过 IPC 从 cache 加载数据，构建内存索引 |
| `services/imageResolver.js` | 图片路径解析：`pic` 字段 → resource/ 实际路径，含 `.png.png` 双后缀回退 |
| `services/edgeExtractor.js` | 从节点数据递归提取关联边（event_on, rite, loot, card 等） |
| `services/conditionParser.js` | 条件 key → 人类可读文本（have, counter, table_have, any, s.is, r:>=） |

### 关键交互流程

```mermaid
sequenceDiagram
    participant U as User
    participant R as Renderer
    participant M as Main Process
    participant FS as File System

    Note over U,FS: 搜索结果拖入画布
    U->>R: 拖拽搜索结果到 Canvas
    R->>R: useCanvasStore.addNode(id, type)
    R->>R: 检查 nodeIdSet 去重
    R->>M: configReadCache(type, id)
    M->>FS: 读取 cache/{type}/{id}.json
    FS-->>M: JSON data
    M-->>R: parsed data
    R->>R: edgeExtractor.extract(data)
    R->>R: 关联数 ≤ 10 → 自动展开
    R->>M: configReadCache(关联节点...)
    M-->>R: 关联节点数据
    R->>R: useCanvasStore.addNodes + addEdges
    R->>R: dagre 自动布局
```

## Data Models

### 节点类型与缓存结构

所有缓存文件共享元数据前缀：

```typescript
interface CacheMeta {
  _source_path: string    // 原始文件绝对路径
  _cached_at: number      // 缓存时间戳 (ms)
  _source_mtime: number   // 原始文件 mtime (ms)
  _parse_error: string | null
}
```

#### Event (cache/event/{id}.json)
```typescript
interface EventData extends CacheMeta {
  id: number              // 53xxxxx
  text: string            // 事件标题/备注
  text__c?: string        // 行尾注释
  is_replay: number
  auto_start: boolean
  on?: object             // 触发条件
  condition: object       // 前置条件
  settlement: Settlement[]
}

interface Settlement {
  tips_text?: string
  tips_resource?: string
  condition?: object
  __c?: string            // 条目注释
  __ca?: string           // 上方注释
  action: {
    confirm?: { id: string; text: string; icon?: string[] }
    option?: Array<{ text: string; action: object }>
    slide?: { pics: string[]; text: string }
    prompt?: object
    success?: ActionResult
    failed?: ActionResult
  }
}

interface ActionResult {
  event_on?: number | number[]
  event_off?: number | number[]
  rite?: number | number[]
  loot?: number | number[]
  card?: number | number[]
  [conditionKey: string]: any  // counter+, counter-, have. 等
}
```

#### Rite (cache/rite/{id}.json)
```typescript
interface RiteData extends CacheMeta {
  id: number              // 50xxxxx
  name: string
  text: string
  settlement_prior?: Settlement[]  // 前置结算
  settlement: Settlement[]         // 主结算
  settlement_extre?: Settlement[]  // 额外结算
  cards_slot?: object
}
```

#### Loot (cache/loot/{id}.json)
```typescript
interface LootData extends CacheMeta {
  id: number              // 60xxxxx
  name: string
  type: number
  type__c?: string
  item: Array<{
    id: string
    type: string
    num: string
    weight: number
  }>
}
```

#### AfterStory (cache/after_story/{id}.json)
```typescript
interface AfterStoryData extends CacheMeta {
  id: number              // 20xxxxx
  name: string
  extra: Array<{
    key: string
    key__c?: string       // 条目名称注释
    sort?: number
    pic?: string          // 图片路径 (cards/xxx)
    condition?: object
    result_text: string
    __ca?: string         // 上方注释 → 章节标题
  }>
}
```

#### Card (cache/single/cards.json 内)
```typescript
interface CardData {
  id: number              // 20xxxxx
  name: string
  title?: string
  text?: string
  resource?: string       // 立绘路径
  tag?: object
  rare?: number
}
```

#### DT (cache/dt/{id}.json)
```typescript
interface DTData extends CacheMeta {
  dialog_tree_id: string  // "DT1" ~ "DT9"
  first_word_id: string
  description: string
  Item: Array<{
    word_id: string
    word: string
    jump_type: string     // "0"=直接跳转, "1"=选项, "3"=结束
    direct_id: string
    Option: Array<{
      option_Jump_word: string
      option_Jump_id: string
      option_Jump_condition?: object
      action?: object
    }>
    action?: object
  }>
}
```

### 画布数据模型

```typescript
// 节点 ID 格式: "{type}:{id}" e.g. "event:5300000"
interface CanvasNode {
  id: string              // "{type}:{id}"
  type: string            // event|rite|loot|after_story|card|over|upgrade|dt
  position: { x: number; y: number }
  data: {
    label: string         // id + name/text 摘要
    nodeType: string
    rawData: object       // 完整缓存数据
  }
}

interface CanvasEdge {
  id: string              // "{source}->{target}:{path}"
  source: string          // 源节点 ID
  target: string          // 目标节点 ID
  data: {
    path: string          // JSON path (e.g. "settlement[0].action.success.event_on")
    branchType: 'success' | 'failed' | 'default'
    conditionText?: string // 关联注释文本
  }
  style: {
    stroke: string        // green/red/gray
  }
}
```

### Edge 提取规则

| 源字段 | 方向 | 目标类型 | 说明 |
|---|---|---|---|
| `event_on` | current → event | event | 触发事件 |
| `event_off` | current → event | event | 关闭事件 |
| `rite` | current → rite | rite | 关联仪式 |
| `loot` | current → loot | loot | 关联战利品 |
| `rite_end` | rite → event | event | 仪式结束触发 |
| `card` | current → card | card | 关联卡牌 |
| `link_card` | upgrade → card | card | 升级关联卡牌 |

Edge 提取需递归遍历 settlement 数组中的 `action.success`、`action.failed`、以及嵌套的 condition 对象。branchType 由所在路径决定：位于 `success` 下为 success，位于 `failed` 下为 failed，其余为 default。

### 条件表达式解析规则

| 原始 key 模式 | 正则 | 展示格式 |
|---|---|---|
| `have.<cardId>` | `/^have\.(.+)$/` | 拥有 [卡牌名] |
| `!have.<cardId>` | `/^!have\.(.+)$/` | 不拥有 [卡牌名] |
| `counter.<id>>=` | `/^counter\.(\d+)>=$/` | 计数器 [注释] ≥ 值 |
| `counter.<id><` | `/^counter\.(\d+)<$/` | 计数器 [注释] < 值 |
| `counter.<id>=` | `/^counter\.(\d+)=$/` | 计数器 [注释] = 值 |
| `counter+<id>` | `/^counter\+(\d+)$/` | 计数器 [注释] +值 |
| `counter-<id>` | `/^counter-(\d+)$/` | 计数器 [注释] -值 |
| `table_have.<t>.<f>` | `/^table_have\.(.+)\.(.+)$/` | 表 [t] 存在 [f] |
| `any` | 字面量 | 满足任意一项: [子条件] |
| `s<d>.is` | `/^s(\d+)\.is$/` | 卡位 [d] 是 [卡牌名] |
| `r<d>:<a>+<a>>=` | `/^r(\d+):(.+)>=$/` | 检定 [属性] ≥ [阈值] |

解析优先级：`__c` 注释文本 > 卡牌名称查表 > 原始 key 名。

### 图片路径解析链

```
pic 字段值 (e.g. "cards/2000001")
  ↓ 提取 name (去掉 "cards/" 前缀)
  ↓
Main Process asset:resolveImage handler:
  尝试 1: resource/Sprite/{name}.png
    ↓ 不存在
  尝试 2: resource/Sprite/{name}.png.png
    ↓ 不存在
  尝试 3: resource/Texture2D/{name}.png
    ↓ 不存在
  尝试 4: resource/Texture2D/{name}.png.png
    ↓ 不存在
  返回 null → UI 显示占位图
  ↓ 存在
  返回 "sultan-asset://Sprite/{name}.png" (自定义协议 URL)
```

### 自动展开防循环机制

游戏事件网络存在循环引用（如：事件 A 失败 → 触发事件 B → B 的选项跳回事件 A）。自动展开逻辑必须防止无限递归：

```
addNode(id, type, data)
  ↓
检查 nodeIdSet.has(id) → 已存在则跳过
  ↓
nodeIdSet.add(id)
  ↓
edgeExtractor.extract(data) → 获取关联列表
  ↓
过滤：移除 target 已在 nodeIdSet 中的关联（防循环）
  ↓
关联数 ≤ 10 → 自动展开（仅展开一层，不递归展开关联的关联）
关联数 > 10 → 折叠，DetailPanel 中手动展开
```

关键约束：
- 自动展开仅展开一层深度，不递归
- `nodeIdSet` 同时作为去重集合和 Visited Set
- dagre 布局引擎配置 `acyclicer: 'greedy'` 处理有环图，或使用 elkjs 替代

### 缓存版本化

缓存文件 metadata 中增加 `_parser_version` 字段：

```typescript
interface CacheMeta {
  _source_path: string
  _cached_at: number
  _source_mtime: number
  _parser_version: string   // e.g. "1.0.0"，解析器逻辑变更时递增
  _parse_error: string | null
}
```

CacheManager 校验缓存有效性时，同时对比 `_source_mtime` 和 `_parser_version`。任一不匹配则强制重新解析。版本号定义在 `gameConfigParser.js` 中作为常量导出。

### AssetStudio CLI 安全调用

使用 `child_process.spawn` 的数组参数形式，避免路径含空格/特殊字符时的命令行断裂：

```javascript
const { spawn } = require('child_process');

// 正确：数组参数，无需手动处理引号
spawn(cliPath, [
  gameDataPath,           // "D:\Steam\...\Sultan's Game_Data"
  resourceDir,
  '--game', 'Normal',
  '--types', 'Sprite:Both',
  '--group_assets', 'ByType',
  '--image_format', 'Png'
]);
```

设置页增加 .NET 8.0 运行时探测：通过执行 `dotnet --list-runtimes` 检查环境，如果未安装则在 UI 直接提示，而非等 AssetStudio 静默失败。

