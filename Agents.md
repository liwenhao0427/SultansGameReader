# 苏丹的游戏资源读取器 - 项目说明

## 项目概述

本项目是一个**桌面端游戏资源阅读器**，目标是在本地实时读取游戏配置文件和图片资源，提供比 `sudans-game-reader`（纯 Web 端）更完整的功能体验。

游戏名称：《苏丹的游戏》（Sultan's Game）

---

## 工作区目录说明

```
工作区根目录/
├── AssetStudio-net8.0-win/   # 游戏资源提取工具（只读，不可修改）
├── config/                   # 游戏配置文件副本（只读，开发参考用）
├── resource/                 # 提取出的游戏图片资源（只读，不可修改）
├── sudans-game-reader/       # 参考项目：旧版 Web 端剧情阅读器（只读，不可修改）
└── Agents.md                 # 本文档
```

> **重要约束**：以上四个目录均为只读参考资料，开发过程中只允许查看，不允许修改。

---

## 各目录详细说明

### AssetStudio-net8.0-win/
- 用途：从游戏安装包中提取原始资源（图片、音频等）
- 技术：.NET 8.0 桌面工具，提供 GUI（`AssetStudio.GUI.exe`）和 CLI（`AssetStudio.CLI.exe`）两种使用方式
- 使用场景：当游戏更新后，用此工具重新提取最新资源到 `resource/` 目录

### config/
- 用途：游戏配置文件的本地副本，供开发时离线参考
- 实际使用：**生产环境应从游戏真实安装目录读取**，此处仅为开发便利
- 数据格式：JSON5（支持注释和尾随逗号的宽松 JSON）
- 主要子目录：
  - `after_story/` — 后日谈剧情（文件名为角色/事件 ID，如 `2000001.json`）
  - `event/` — 游戏事件（1337 个文件，ID 以 `53xxxxx` 开头）
  - `loot/` — 战利品配置（147 个文件，ID 以 `60xxxxx` 开头）
  - `rite/` — 仪式配置
  - `rite_template/` — 仪式模板
  - `dt/` — DT 系列配置（DT1.json ~ DT9.json）
  - `wizard/` — 向导配置
  - `init/` — 初始化配置（0.json, 1.json）
  - `cards.json` — 卡牌数据
  - `quest.json` — 任务数据
  - `variable.json` — 游戏变量定义
  - `tag.json` — 标签定义
  - `upgrade.json` — 升级配置
  - `over.json` — 结局配置
  - `credits.json` — 制作人员名单

### resource/
- 用途：已提取的游戏图片资源
- 子目录：
  - `Sprite/` — UI 精灵图（角色立绘、图标、背景等）
  - `Texture2D/` — 原始纹理贴图（含法线贴图 `_n`、金属度贴图 `_mt` 等）
- 命名规律：
  - 数字 ID（如 `2000001.png`）对应游戏内角色/事件 ID
  - 带后缀变体（如 `2000001_1.png`、`2000001_2.png`）为同一角色的不同立绘
  - 中文命名（如 `阿哞.png`、`崔家瑞.png`）为 NPC 角色立绘
  - `_bg` / `_fg` 后缀分别表示背景层和前景层

### sudans-game-reader/
- 用途：参考项目，了解数据结构和业务逻辑
- 技术栈：Vue 2 + Webpack + Element Plus
- 局限性（本项目需要解决的问题）：
  - 纯 Web 端，无法实时读取本地文件系统
  - 不支持图片显示
  - 配置数据需要预先打包，无法跟随游戏更新自动同步
- 参考价值：
  - `src/services/eventService.js` — 数据加载和解析逻辑
  - `src/components/` — 各类数据的展示组件（事件、仪式、战利品、结局、后日谈、卡牌）
  - `scripts/` — Python 数据处理脚本（JSON5 解析、数据提取等）

---

## 配置文件数据格式

游戏配置**不是标准 JSON，也不是 JSON5**，而是游戏策划团队自定义的格式，由游戏引擎内部解析器读取。它在语法上接近 JSON5，但存在若干 JSON5 也不支持的特性，解析时需要特别处理。

### 格式特性

- 支持单行注释（`//`）和块注释（`/* */`）
- 支持尾随逗号
- **支持同一对象内的重复 key**（这是标准 JSON 和 JSON5 都不支持的）
- key 中可包含特殊字符：`!`、`>=`、`<=`、`>`、`<`、`+`、`-`、`.` 等（这些在 JSON 规范中是合法字符串，但在 JS 对象字面量中不合法）

### 典型数据结构示例（event）

```json5
{
  "id": 5300000,
  "text": "开场介绍",  // 策划备注
  "settlement": [
    {
      "action": {
        "success": {
          "event_on": [5300300, 5300301],  // 数组形式
          "event_on": 5300066              // 重复 key！游戏引擎会合并处理
        }
      }
    }
  ]
}
```

### 典型数据结构示例（after_story）

```json5
{
  "id": 2000001,
  "name": "主角",
  "prior": [],
  "extra": [
    {
      "key": "2000001_extra_1",
      "sort": 99,
      "pic": "cards/yrl",
      "condition": {
        "counter.7000490>=": 1,   // key 中含特殊字符 >= 和 .
        "!have.妻子": 1           // key 中含 ! 和 .
      },
      "result_text": "..."
    }
  ]
}
```

### 条件系统说明

配置中的 `condition` 字段使用游戏内部条件语法，**条件表达式编码在 key 名中**：
- `"have.卡牌ID": 1` — 拥有指定卡牌
- `"!have.卡牌ID": 1` — 不拥有指定卡牌
- `"counter.计数器ID>=": 值` — 计数器大于等于某值
- `"counter.计数器ID<": 值` — 计数器小于某值
- `"counter+计数器ID": 值` — 计数器加法操作（action 中）
- `"counter-计数器ID": 值` — 计数器减法操作（action 中）
- `"table_have.表ID.字段": 1` — 表中存在指定字段
- `"any": { ... }` — 满足其中任意一个条件

---

## 配置文件解析：坑点与标准处理方式

### 坑点一：重复 key（最核心问题）

这是与 JSON5 最本质的区别。同一个对象内可以出现多个同名 key，游戏引擎会将它们合并处理（通常视为数组或取最后一个值）。

**实际案例**（`config/event/5300000.json`）：
```json
"success": {
    "event_on": [5300300, 5300301, 5300302, 5300303],
    "event_on": 5300066   // 同一对象内第二个 event_on
}
```

**影响**：
- `JSON.parse()` 会静默丢弃前面的值，只保留最后一个
- `JSON5.parse()` 行为相同，同样会丢失数据
- Python 的 `json.loads()` 默认也只保留最后一个

**标准处理方式**：使用支持 `object_pairs_hook` 的解析器，在解析阶段收集所有重复 key，合并为数组：

```python
# Python 推荐方案
from collections import defaultdict
import commentjson  # pip install commentjson

def hook(pairs):
    result = defaultdict(list)
    for key, value in pairs:
        result[key].append(value)
    # 只有真正重复的 key 才转为数组，单个值保持原样
    return {k: v if len(v) > 1 else v[0] for k, v in result.items()}

data = commentjson.loads(json_str, object_pairs_hook=hook)
```

```javascript
// JavaScript 推荐方案：自定义解析器
// JSON.parse 和 JSON5.parse 均无法处理重复 key
// 需要在词法层面手动扫描，收集重复 key 后合并
// 参考 sudans-game-reader/src/services/eventService.js 中的 parseJSONWithDuplicateKeys
```

**已知需要合并为数组的 key**（来自旧项目经验）：
`rite`、`event_on`、`rite_end`、`card`、`loot`

### 坑点二：key 中含特殊字符

条件表达式直接编码在 key 名里，包含 `!`、`>=`、`<=`、`>`、`<`、`+`、`-`、`.` 等字符。这些字符在 JSON 字符串中是合法的，但：

- 如果用 `new Function('return ' + json)()` 方式解析（JS eval 风格），这些 key 会导致语法错误
- Python 的 `json.loads()` 可以正常处理（key 是字符串，特殊字符无影响）
- 旧项目的预处理脚本会将这些字符替换为中文（`>=` → `大于等于`、`!` → `非`），**本项目实时读取时不应做此替换**，应保留原始 key 名，在展示层做转义处理

### 坑点三：注释中可能包含引号或特殊字符

用正则表达式移除注释时，需要注意注释内容本身可能包含 `"` 或 `{}`，简单的正则可能误匹配。

**推荐**：优先使用 `commentjson` 库（Python）或专门的注释剥离库，而非手写正则。

**危险的正则**（旧项目中出现过的问题）：
```javascript
// 错误：会误匹配字符串内的 //
jsonString.replace(/\/\/[^\n]*/g, '')

// 较好：跳过引号内的内容（但仍不完美）
jsonString.replace(/([^"\\]|^)\/\/[^\n]*/g, '$1')
```

### 坑点四：尾随逗号

标准 JSON 不允许尾随逗号，但此格式大量使用。处理顺序很重要：**必须先移除注释，再处理尾随逗号**，否则注释中的 `}` 或 `]` 会干扰尾随逗号的正则匹配。

```python
# 正确顺序
content = remove_comments(content)   # 先去注释
content = re.sub(r',(\s*[}\]])', r'\1', content)  # 再去尾随逗号
```

### 坑点五：旧项目的预处理做了什么（本项目需要绕过）

`sudans-game-reader/scripts/json5_parser.py` 对配置做了以下**不可逆转换**，本项目实时读取时**不应复现**：

1. 将重复 key 合并为数组（✅ 应保留此逻辑）
2. 将 key 中的特殊字符替换为中文（`>=` → `大于等于` 等）（❌ 不应做，会破坏原始语义）
3. 将稀有度数字转为中文（`1` → `石`、`2` → `铜` 等）（❌ 不应做，展示层处理）
4. 生成了 `game_data_index.json` 索引文件（❌ 本项目需要实时扫描目录替代）

### 坑点六：`.png.png` 双后缀图片

`resource/Sprite/` 和 `resource/Texture2D/` 下存在大量 `文件名.png.png` 的文件，这是 AssetStudio 提取时的产物（原始资源名已含 `.png`，提取工具又追加了一次）。

查找图片时需要同时尝试两种路径：
```
resource/Sprite/2000001.png       ← 优先
resource/Sprite/2000001.png.png   ← 备选
```

### 推荐解析流程

```
原始文件
  ↓
1. 读取文本（UTF-8）
  ↓
2. 使用 commentjson（Python）或手写状态机剥离注释
  ↓
3. 移除尾随逗号
  ↓
4. 使用 object_pairs_hook 解析，收集重复 key 合并为数组
  ↓
5. 保留原始 key 名（不做字符替换）
  ↓
解析结果（Python dict / JS object）
```

---

## 图片资源与配置的对应关系

配置中的 `pic` 字段指向图片路径，规则如下：
- `"pic": "cards/2000001"` → `resource/Sprite/2000001.png`
- `"pic": "cards/yrl"` → `resource/Sprite/yrl.png`
- 数字 ID 图片（如 `2000001.png`）通常是角色立绘
- 部分角色有多张立绘变体（`2000001_1.png`、`2000001_2.png` 等）

---

## 新项目开发目标

相比 `sudans-game-reader`，新项目需要实现：

1. **本地文件读取** — 直接读取游戏安装目录的配置文件，无需手动复制
2. **图片显示** — 展示角色立绘和游戏图片
3. **实时同步** — 游戏更新后自动读取最新配置
4. **桌面端体验** — 原生桌面应用或本地服务，不依赖网络

---

## 图片资源与配置的对应关系

配置中的 `pic` 字段指向图片路径，规则如下：
- `"pic": "cards/2000001"` → `resource/Sprite/2000001.png`
- `"pic": "cards/yrl"` → `resource/Sprite/yrl.png`
- 数字 ID 图片（如 `2000001.png`）通常是角色立绘
- 部分角色有多张立绘变体（`2000001_1.png`、`2000001_2.png` 等）
- 查找图片时需同时尝试 `.png` 和 `.png.png` 两种后缀（见坑点六）

---

## 其他开发注意事项

- 配置文件**不是 JSON5**，是游戏自定义格式，详见上方"坑点"章节
- 部分配置文件体积较大（如 `after_story/2000001.json` 超过 1400 行），实时读取时注意性能
- 游戏真实配置目录路径需要在应用中可配置，不能硬编码
- 旧项目 `sudans-game-reader` 的 `src/assets/config/` 是经过预处理的版本，key 名已被修改，**不能作为格式参考**，应以 `config/` 目录下的原始文件为准
