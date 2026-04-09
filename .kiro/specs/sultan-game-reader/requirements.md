# Requirements Document

## Introduction

苏丹的游戏（Sultan's Game）本地剧情阅读器是一个基于 Electron 的桌面应用，用于读取游戏本地配置文件和图片资源，以节点图 + 类视觉小说形式呈现游戏剧情结构。核心目标是让玩家和策划能快速检索任意事件、仪式、结局、后日谈等，通过可视化节点图理解剧情分支关系，并以视觉小说形式阅读剧情文本和角色立绘。

应用技术栈：Electron + React + Vite + @xyflow/react + Zustand。

数据流：用户选择游戏目录 → 解析器读取 config/ → 写入 cache/ → 前端从 cache/ 读取；用户提取资源 → AssetStudio CLI → 写入 resource/ → 前端从 resource/ 读取。

## Glossary

- **Application**: 苏丹的游戏本地剧情阅读器桌面应用（Electron 主进程 + React 渲染进程）
- **Main_Process**: Electron 主进程，负责文件系统访问、配置解析、IPC 通信
- **Renderer**: React 渲染进程，负责 UI 展示
- **Parser**: 配置文件解析器模块（位于 `sultan-reader/electron/parser/`），处理游戏自定义格式（注释、尾随逗号、重复 key）
- **Cache_Manager**: 缓存管理器，基于 mtime 的增量缓存机制，将解析结果写入 cache/ 目录
- **Search_Index**: 内存中的全量搜索索引，从 cache 目录构建，包含 id、type、name、text 字段
- **Canvas**: 基于 @xyflow/react 的节点图画布组件
- **Detail_Panel**: 右侧详情面板，以类视觉小说风格展示节点内容
- **Counter_Registry**: 计数器注册表，从缓存文件中提取所有 `counter.XXXXXXX` 格式的 key 及其注释
- **Condition_Parser**: 条件表达式解析器，将编码在 key 名中的条件（如 `counter.7000490>=`、`!have.妻子`）转义为人类可读文本
- **Image_Resolver**: 图片路径解析函数，将配置中的 `pic` 字段映射到 resource/ 目录下的实际文件路径
- **AssetStudio_CLI**: AssetStudio 命令行工具（`AssetStudio.CLI.exe`），用于从游戏安装包提取 Sprite 和 Texture2D 资源
- **Node**: 画布上的可视化节点，代表一个游戏配置实体（event、rite、loot 等 8 种类型）
- **Edge**: 画布上节点之间的连线，代表配置数据中的关联关系（event_on、rite、loot 等字段）
- **Settlement**: 事件配置中的结算条目，包含条件、交互类型（confirm/option/slide/prompt）、结果文本和 success/failed 分支

## Requirements

### Requirement 1: Electron 应用脚手架与 IPC 通信

**User Story:** As a developer, I want a properly structured Electron + React + Vite application with IPC communication between main and renderer processes, so that the frontend can securely access local file system operations through the main process.

#### Acceptance Criteria

1. THE Application SHALL initialize as an Electron application with a Main_Process and a Renderer based on React + Vite
2. THE Main_Process SHALL integrate the existing Parser module from `sultan-reader/electron/parser/`
3. THE Main_Process SHALL expose IPC channels (`config:setGameDir`, `config:rebuildCache`, `config:clearCache`, `config:readCache`, `config:listCache`, `config:buildIndex`, `asset:setCliPath`, `asset:extract`, `asset:resolveImage`, `file:readRaw`, `settings:get`, `settings:set`) to the Renderer via a preload script
4. THE Renderer SHALL access Main_Process functionality exclusively through the preload-exposed IPC API
5. THE Main_Process SHALL persist user settings (game directory, AssetStudio CLI path, resource directory, cache directory) to Electron userData

### Requirement 2: 设置页

**User Story:** As a player, I want a settings page to configure game directory, AssetStudio path, and manage cache/resources, so that the application can locate and process my game files.

#### Acceptance Criteria

1. THE Application SHALL provide a settings page accessible from the main UI
2. WHEN the user clicks the game directory selector, THE Application SHALL open a native directory picker dialog and store the selected path to Electron userData
3. WHEN the user clicks the AssetStudio path selector, THE Application SHALL open a native file picker dialog filtered to executable files and store the selected path
4. THE Application SHALL display configurable resource directory and cache directory paths, defaulting to `<appData>/resource/` and `<appData>/cache/` respectively
5. WHEN the user clicks "更新配置缓存", THE Main_Process SHALL invoke the Cache_Manager to scan the game config directory (`<gamePath>/Sultan's Game_Data/StreamingAssets/config`) and write parsed results to the cache directory
6. WHEN the user clicks "提取游戏资源", THE Main_Process SHALL execute AssetStudio_CLI with the configured game path and resource output directory, extracting both Sprite and Texture2D assets in PNG format
7. WHEN the user clicks "清除缓存", THE Main_Process SHALL delete all files in the cache directory
8. THE Application SHALL display an inline tutorial on the settings page explaining the .NET 8.0 runtime requirement for AssetStudio
9. IF the configured game directory does not contain a valid `Sultan's Game_Data/StreamingAssets/config` path, THEN THE Application SHALL display a validation error message

### Requirement 3: 配置解析与缓存

**User Story:** As a player, I want the application to parse game configuration files and cache the results, so that subsequent loads are fast and I don't need to re-parse unchanged files.

#### Acceptance Criteria

1. THE Parser SHALL handle the game's custom config format: single-line comments (`//`), block comments (`/* */`), trailing commas, and duplicate keys within the same object
2. THE Parser SHALL inline comments into the parsed result using `__c` (inline comment), `__ca` (above comment), and `__ci` (scalar array item comments) field suffixes
3. THE Parser SHALL merge duplicate keys listed in ARRAY_MERGE_KEYS (`rite`, `event_on`, `rite_end`, `card`, `loot`, `choose`) by flattening all values into a single array
4. THE Parser SHALL preserve original key names containing special characters (`!`, `>=`, `<=`, `>`, `<`, `+`, `-`, `.`) without any character substitution
5. THE Cache_Manager SHALL use file mtime comparison to determine cache validity, skipping re-parse for unchanged source files
6. THE Cache_Manager SHALL store metadata in each cache entry: `_source_path`, `_cached_at`, `_source_mtime`, `_parse_error`
7. THE Cache_Manager SHALL scan all config subdirectories (event, rite, loot, after_story, dt, init, wizard, rite_template) and single files (cards.json, upgrade.json, over.json, quest.json, variable.json, tag.json)
8. WHEN the `config:rebuildCache` IPC channel is invoked, THE Main_Process SHALL report progress (current file count, total file count) back to the Renderer
9. FOR ALL valid configuration files, parsing then serializing to JSON then re-parsing SHALL produce an equivalent data object (round-trip property for the cache layer)

### Requirement 4: 搜索面板与索引构建

**User Story:** As a player, I want to search across all game configurations by keyword, so that I can quickly find specific events, characters, items, or story content.

#### Acceptance Criteria

1. WHEN the application starts with a valid cache directory, THE Application SHALL build a Search_Index in memory containing entries with id, type, name, and text fields from all cached files
2. THE Search_Index SHALL support fuzzy keyword matching against id, name, and text fields
3. THE Application SHALL display a search panel on the left side with a text input and type filter checkboxes (event, rite, loot, after_story, over, card, upgrade, dt)
4. WHEN the user enters a search query, THE Application SHALL display matching results as a scrollable list showing id, name, and type tag for each result
5. WHEN the user drags a search result item, THE Application SHALL initiate a drag operation that allows dropping the item onto the Canvas as a new Node

### Requirement 5: 节点图画布

**User Story:** As a player, I want an interactive node graph canvas to visualize relationships between events, rites, loot, and other game entities, so that I can understand the branching story structure.

#### Acceptance Criteria

1. THE Canvas SHALL render Nodes using @xyflow/react, with each Node colored by its type (event, rite, loot, after_story, card, over, upgrade, dt)
2. THE Canvas SHALL display each Node with its id and a name/text summary
3. THE Canvas SHALL maintain a `Set<nodeId>` to prevent duplicate Nodes from being added
4. WHEN a Node is added to the Canvas and the Node has 10 or fewer direct associations, THE Canvas SHALL automatically expand and display all directly associated Nodes and Edges
5. WHEN a Node is added to the Canvas and the Node has more than 10 direct associations, THE Canvas SHALL display the Node in a collapsed state, with manual expansion available from the Detail_Panel
6. THE Canvas SHALL render Edges with color coding: green for success branches, red for failed branches, and gray for default/other associations
7. WHEN the user clicks an Edge, THE Canvas SHALL display a floating tooltip showing the condition text and associated comments
8. THE Canvas SHALL apply automatic layout (using dagre or elkjs) to newly added Nodes while preserving manually adjusted positions for existing Nodes
9. THE Canvas SHALL support standard interactions: pan, zoom, and manual Node dragging

### Requirement 6: Edge 提取与关联解析

**User Story:** As a player, I want the application to automatically extract and display relationships between game entities, so that I can see how events, rites, loot, and cards connect to each other.

#### Acceptance Criteria

1. THE Application SHALL extract Edges from the following fields in cached data: `event_on` (current → event), `event_off` (current → event), `rite` (current → rite), `loot` (current → loot), `rite_end` (rite → event), `card` (current → card), `link_card` (upgrade → card)
2. THE Application SHALL construct each Edge with: source node id (prefixed by type, e.g. `event:5300000`), target node id, the JSON path where the reference was found, branch type (success/failed/default), and condition text from associated comments
3. THE Application SHALL recursively traverse nested settlement structures (including `action.success`, `action.failed`, and condition objects) to extract all references

### Requirement 7: 详情面板 — Event 节点

**User Story:** As a player, I want to read event details in a visual-novel style panel, so that I can understand the story content, choices, and branching outcomes of each event.

#### Acceptance Criteria

1. WHEN the user clicks an event Node on the Canvas, THE Detail_Panel SHALL display the event title (text field) with its inline comment (`__c`)
2. THE Detail_Panel SHALL display the event's trigger conditions (condition object), with each condition key parsed by the Condition_Parser into human-readable text
3. THE Detail_Panel SHALL render each settlement entry showing: condition with comments, interaction type identifier (confirm/option/slide/prompt), result text (result_text/tips_text), and success/failed branch details
4. WHEN a settlement contains image references (slide or icon fields), THE Detail_Panel SHALL display the resolved images using Image_Resolver
5. THE Detail_Panel SHALL provide a "查看原始文件" button that displays the raw configuration file content read from the `_source_path` metadata field

### Requirement 8: 详情面板 — Rite 节点

**User Story:** As a player, I want to read rite (仪式) details showing the three-phase settlement structure, so that I can understand the complete ritual flow.

#### Acceptance Criteria

1. WHEN the user clicks a rite Node on the Canvas, THE Detail_Panel SHALL display the rite name and description
2. THE Detail_Panel SHALL render the three settlement phases in order: settlement_prior, settlement, settlement_extre
3. THE Detail_Panel SHALL display each phase's conditions (parsed by Condition_Parser), result text, and associated actions

### Requirement 9: 详情面板 — After Story 节点

**User Story:** As a player, I want to read after-story (后日谈) content with character art and chapter headings, so that I can explore epilogue stories for each character.

#### Acceptance Criteria

1. WHEN the user clicks an after_story Node on the Canvas, THE Detail_Panel SHALL display the character name and character portrait resolved from the `pic` field via Image_Resolver
2. THE Detail_Panel SHALL render each entry in the `extra` array showing: condition (parsed by Condition_Parser), result text, and character portrait (if `pic` field is present)
3. WHEN an extra entry has an `__ca` (above comment) field, THE Detail_Panel SHALL display the comment text as a chapter/section heading (e.g. "结局新日之书")

### Requirement 10: 详情面板 — Card、Loot、Over、Upgrade、DT 节点

**User Story:** As a player, I want to view details for cards, loot, endings, upgrades, and dialog trees, so that I can explore all game content types.

#### Acceptance Criteria

1. WHEN the user clicks a card Node, THE Detail_Panel SHALL display the card's name, title, description (text), portrait (resource field resolved via Image_Resolver), tags (tag object), and rarity
2. WHEN the user clicks a loot Node, THE Detail_Panel SHALL display the loot name, type, and a list of drop items (item array) with each item's id, type, num, and weight
3. WHEN the user clicks an over Node, THE Detail_Panel SHALL display the ending content indexed by its key
4. WHEN the user clicks an upgrade Node, THE Detail_Panel SHALL display the upgrade name, text, effect, conditions (parsed by Condition_Parser), and linked card (link_card)
5. WHEN the user clicks a dt Node, THE Detail_Panel SHALL display the dialog tree description and render the conversation flow: each Item's word text, jump type, options (with option_Jump_word), and branching structure

### Requirement 11: 条件表达式解析

**User Story:** As a player, I want game condition expressions displayed as readable text, so that I can understand the requirements for each story branch without decoding raw key names.

#### Acceptance Criteria

1. THE Condition_Parser SHALL parse `have.<cardId>` keys and display them as "拥有 [卡牌名]", resolving the card name from the cards cache
2. THE Condition_Parser SHALL parse `!have.<cardId>` keys and display them as "不拥有 [卡牌名]"
3. THE Condition_Parser SHALL parse `counter.<id>>=` keys and display them as "计数器 [注释文本] ≥ 值", using the `__c` comment field as the primary label
4. THE Condition_Parser SHALL parse `counter.<id><` keys and display them as "计数器 [注释文本] < 值"
5. THE Condition_Parser SHALL parse `counter.<id>=` keys and display them as "计数器 [注释文本] = 值"
6. THE Condition_Parser SHALL parse `counter+<id>` and `counter-<id>` keys as counter modification actions, displaying "计数器 [注释文本] +值" and "计数器 [注释文本] -值"
7. THE Condition_Parser SHALL parse `table_have.<tableId>.<field>` keys and display them as "表 [表ID] 存在 [字段]"
8. THE Condition_Parser SHALL parse `any` keys and display the nested conditions as "满足任意一项: [子条件列表]"
9. THE Condition_Parser SHALL parse `s<digit>.is` keys and display them as "卡位 [数字] 是 [卡牌名]"
10. THE Condition_Parser SHALL parse `r<digit>:<attr>+<attr>>=` keys and display them as "检定 [属性] ≥ [阈值]"
11. THE Condition_Parser SHALL prioritize `__c` comment text over raw key names when displaying condition labels

### Requirement 12: 图片路径解析

**User Story:** As a player, I want character portraits and game images to display correctly, so that I can enjoy the visual-novel reading experience.

#### Acceptance Criteria

1. WHEN a `pic` field value follows the pattern `cards/<name>`, THE Image_Resolver SHALL search for the image file at `resource/Sprite/<name>.png`
2. IF the primary path `resource/Sprite/<name>.png` does not exist, THEN THE Image_Resolver SHALL fall back to `resource/Sprite/<name>.png.png` (AssetStudio double-suffix artifact)
3. IF neither Sprite path exists, THEN THE Image_Resolver SHALL search in `resource/Texture2D/<name>.png` and `resource/Texture2D/<name>.png.png`
4. IF no matching image file is found at any path, THEN THE Image_Resolver SHALL return null and the UI SHALL display a placeholder

### Requirement 13: 资源提取集成

**User Story:** As a player, I want to extract game image resources through the application, so that I don't need to manually run AssetStudio commands.

#### Acceptance Criteria

1. WHEN the user triggers resource extraction, THE Main_Process SHALL execute AssetStudio_CLI with the command: `AssetStudio.CLI.exe "<gamePath>\Sultan's Game_Data" "<resourceDir>" --game Normal --types Sprite:Both --group_assets ByType --image_format Png`
2. THE Main_Process SHALL execute a second AssetStudio_CLI command for Texture2D: `AssetStudio.CLI.exe "<gamePath>\Sultan's Game_Data" "<resourceDir>" --game Normal --types Texture2D --group_assets ByType --image_format Png`
3. WHILE the AssetStudio_CLI process is running, THE Application SHALL display extraction progress or a loading indicator to the user
4. IF the AssetStudio_CLI executable is not found at the configured path, THEN THE Application SHALL display an error message indicating the CLI path is invalid
5. IF the AssetStudio_CLI process exits with a non-zero code, THEN THE Application SHALL display the error output to the user

### Requirement 14: 计数器与开关管理

**User Story:** As a player, I want to manage game counters and switches with simulated values, so that I can explore different story branches based on various game states.

#### Acceptance Criteria

1. THE Application SHALL scan all cached files and extract all keys matching the `counter.<id>` pattern to build a Counter_Registry
2. THE Counter_Registry SHALL store each counter's ID, comment description (from `__c` fields), and a user-editable simulated value (default 0)
3. WHEN the user modifies a counter's simulated value, THE Application SHALL persist the value to localStorage or Electron userData
4. THE Application SHALL provide a side panel UI for viewing and editing all registered counters

### Requirement 15: 玩家状态模拟与分支高亮

**User Story:** As a player, I want to simulate my game state (triggered events, counter values) and see which story branches are available, so that I can plan my gameplay or understand what conditions lead to different outcomes.

#### Acceptance Criteria

1. THE Application SHALL allow the user to mark event IDs as "已触发" (triggered)
2. WHEN the user has configured counter values and triggered events, THE Application SHALL evaluate condition expressions on visible Edges and settlement entries against the simulated state
3. WHILE simulated state is active, THE Canvas SHALL highlight Edges whose conditions are satisfied with full opacity and reduce opacity for Edges whose conditions are not satisfied
4. WHILE simulated state is active, THE Detail_Panel SHALL highlight after_story extra entries whose conditions are satisfied
5. THE Application SHALL persist the simulated player state (triggered events, counter values) across application restarts

### Requirement 16: 原始文件对比视图

**User Story:** As a developer/modder, I want to view the raw configuration file alongside the parsed result, so that I can verify parsing correctness and understand comment placement.

#### Acceptance Criteria

1. WHEN the user clicks "查看原始文件" in the Detail_Panel, THE Application SHALL read the raw file content from the path stored in `_source_path` via the `file:readRaw` IPC channel
2. THE Application SHALL display the raw file content with syntax highlighting for comments
3. THE Application SHALL visually annotate positions where duplicate keys were merged and where comments were inlined

### Requirement 17: 大文件性能

**User Story:** As a player, I want the application to handle large configuration files (1000+ lines) and large datasets (27000+ line cards.json, 1337 event files) without UI freezing, so that I can browse all content smoothly.

#### Acceptance Criteria

1. WHEN rendering detail content for files exceeding 1000 lines (e.g. after_story/2000001.json with 1407 lines), THE Detail_Panel SHALL use virtualized or paginated rendering to maintain responsive UI
2. THE Search_Index construction SHALL complete within 5 seconds for the full dataset (approximately 2934 cached files)
3. WHEN loading single-file large objects (cards.json ~27000 lines, over.json, upgrade.json), THE Main_Process SHALL parse and cache them as single entries under `cache/single/`
