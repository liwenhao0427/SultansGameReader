# Implementation Plan: Sultan Game Reader

## Overview

Build a desktop game story reader using Electron + React + Vite + @xyflow/react + Zustand. The parser layer (`commentStripper.js`, `gameConfigParser.js`, `cacheManager.js`) is already complete at `sultan-reader/electron/parser/` — tasks integrate it without recreating. Development follows the spec-defined order: scaffolding → settings → search → canvas → detail panels → counters → asset extraction → raw comparison.

## Tasks

- [x] 1. Electron scaffolding, Vite + React setup, and IPC communication
  - [x] 1.1 Initialize project with package.json, Vite config, and Electron entry point
    - Create `sultan-reader/package.json` with dependencies: electron, react, react-dom, @vitejs/plugin-react, vite, vite-plugin-electron, zustand, @xyflow/react, dagre
    - Create `sultan-reader/vite.config.js` with React plugin and Electron integration
    - Create `sultan-reader/index.html` as Vite entry
    - Create `sultan-reader/src/main.jsx` as React entry point
    - Create `sultan-reader/src/App.jsx` with basic router (settings page vs main layout)
    - _Requirements: 1.1_

  - [x] 1.2 Create Electron main process with IPC handlers and custom protocol
    - Create `sultan-reader/electron/main.js`: BrowserWindow creation, integrate existing parser module from `sultan-reader/electron/parser/`, register all IPC handlers via `ipcMain.handle`
    - **Register `sultan-asset://` custom protocol** via `protocol.handle('sultan-asset', ...)` for secure local image loading — Renderer uses `<img src="sultan-asset://Sprite/2000001.png">`, Main Process intercepts and returns local file stream. Do NOT disable `webSecurity`.
    - IPC channels: `config:setGameDir`, `config:rebuildCache`, `config:clearCache`, `config:readCache`, `config:listCache`, `config:buildIndex`, `config:search`, `config:getCardsLite`, `asset:setCliPath`, `asset:extract`, `asset:resolveImage`, `asset:checkDotnet`, `file:readRaw`, `settings:get`, `settings:set`
    - Use `electron-store` or JSON file in userData for settings persistence (game directory, AssetStudio CLI path, resource directory, cache directory)
    - `config:setGameDir`: validate path contains `Sultan's Game_Data/StreamingAssets/config`, store to settings, return `{ configDir, success }`
    - `config:rebuildCache`: instantiate CacheManager, call `scanAll()` with progress callback, send progress via IPC event. Also generate `cards_lite.json` (id → name mapping) in cache/single/ for frontend condition parsing.
    - `config:clearCache`: call `CacheManager.invalidate(type?)`, return `{ success }`
    - `config:readCache`: read `cache/{type}/{id}.json`, return parsed JSON
    - `config:listCache`: scan `cache/{type}/` directory, return array of `{ id, name, text }`
    - `config:buildIndex`: **build search index in Main Process memory**, return only statistics `{ counts: { event: 1337, rite: N, ... } }` — do NOT send full index to Renderer
    - `config:search`: **Main Process side search** — receive `(query, types?)`, fuzzy match against in-memory index, return top 100 results `[{ id, type, name, text }]`
    - `config:getCardsLite`: return `cards_lite.json` content (id → name mapping, ~few KB)
    - `asset:resolveImage`: implement image resolution chain (Sprite .png → Sprite .png.png → Texture2D .png → Texture2D .png.png → null), **return `sultan-asset://` protocol URL** instead of local absolute path
    - `asset:checkDotnet`: execute `dotnet --list-runtimes`, check for .NET 8.0+, return `{ available, version? }`
    - `file:readRaw`: read file at given path, return UTF-8 string
    - `settings:get` / `settings:set`: read/write from persistent store
    - _Requirements: 1.2, 1.3, 1.5, 3.5, 3.6, 3.7, 3.8, 12.1, 12.2, 12.3, 12.4_

  - [x] 1.3 Create preload script exposing IPC API to renderer
    - Create `sultan-reader/electron/preload.js`: use `contextBridge.exposeInMainWorld('electronAPI', { ... })` to expose all IPC channels as async functions
    - Include new channels: `configSearch`, `configGetCardsLite`, `assetCheckDotnet`
    - Expose progress callback support for `configRebuildCache` using `ipcRenderer.on` for progress events
    - _Requirements: 1.3, 1.4_

  - [x] 1.4 Add parser version to CacheManager for cache invalidation
    - Add `PARSER_VERSION` constant (e.g. `"1.0.0"`) to `gameConfigParser.js` and export it
    - Update `CacheManager._parseAndCache` to include `_parser_version` in cache metadata
    - Update `CacheManager._isCacheValid` to compare both `_source_mtime` AND `_parser_version` — if either mismatches, force re-parse
    - _Requirements: 3.5, 3.6_

  - [x]* 1.5 Write unit tests for IPC handlers
    - Test `config:setGameDir` validates path correctly (valid and invalid paths)
    - Test `asset:resolveImage` fallback chain (all 4 paths + null), verify returns `sultan-asset://` URL
    - Test `config:search` returns correct results for keyword queries
    - Test `asset:checkDotnet` handles both installed and missing .NET scenarios
    - _Requirements: 1.3, 12.1, 12.2, 12.3, 12.4_

- [ ] 2. Checkpoint — Verify Electron app launches
  - Ensure the Electron app starts, shows a blank React page, and IPC communication works between main and renderer processes. Ask the user if questions arise.

- [x] 3. Settings page
  - [x] 3.1 Create SettingsPage component with directory/path selectors
    - Create `sultan-reader/src/components/SettingsPage.jsx`
    - Game directory selector: button triggers native directory picker via IPC, stores path via `electronAPI.settingsSet('gamePath', ...)`
    - AssetStudio CLI path selector: button triggers file picker filtered to `.exe`, stores via settings
    - Resource directory and cache directory inputs with defaults (`<appData>/resource/`, `<appData>/cache/`), editable
    - Validation: after selecting game directory, check if `Sultan's Game_Data/StreamingAssets/config` exists via IPC, display error if invalid
    - Display inline tutorial text explaining .NET 8.0 runtime requirement for AssetStudio
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.8, 2.9_

  - [x] 3.2 Implement cache and resource management buttons
    - "更新配置缓存" button: calls `electronAPI.configRebuildCache()`, shows progress bar (current/total files), displays result summary
    - "提取游戏资源" button: calls `electronAPI.assetExtract(...)`, shows loading indicator during extraction
    - "清除缓存" button: calls `electronAPI.configClearCache()`, shows confirmation dialog before clearing
    - _Requirements: 2.5, 2.6, 2.7_

  - [x] 3.3 Add routing between settings page and main layout
    - Update `App.jsx` with simple state-based routing: settings page vs main layout
    - Add navigation button/link to switch between settings and main view
    - _Requirements: 2.1_

- [ ] 4. Checkpoint — Settings page functional
  - Ensure settings page renders, directory pickers work, cache rebuild triggers parsing via IPC, and settings persist across restarts. Ask the user if questions arise.

- [x] 5. Search panel and index construction
  - [x] 5.1 Create useConfigStore with cards lite mapping
    - Create `sultan-reader/src/stores/useConfigStore.js` using Zustand
    - State: `cardsLite` (Map of card id → name, loaded from `config:getCardsLite`), `counterRegistry` (Map of counter id → { id, comment, value }), `indexStats` (type → count), `isLoaded` flag
    - Action: `initialize()` — calls `electronAPI.configBuildIndex()` to get stats, calls `electronAPI.configGetCardsLite()` to load cards mapping
    - **Search index is NOT stored in frontend** — search requests go through `electronAPI.configSearch(query, types)` IPC call
    - _Requirements: 4.1, 17.2_

  - [x] 5.2 Create SearchPanel component
    - Create `sultan-reader/src/components/SearchPanel.jsx`
    - Text input for keyword search — **calls `electronAPI.configSearch(query, selectedTypes)` on input change** (debounced), receives results from Main Process
    - Type filter checkboxes: event, rite, loot, after_story, over, card, upgrade, dt
    - Scrollable result list showing id, name/text snippet, and colored type tag
    - _Requirements: 4.2, 4.3, 4.4_

  - [x] 5.3 Implement drag-from-search to canvas
    - Add `draggable` attribute and `onDragStart` handler to search result items, setting transfer data with `{ id, type }`
    - Canvas component handles `onDrop` to create a new node at drop position
    - _Requirements: 4.5_

  - [x]* 5.4 Write unit tests for search filtering
    - Test fuzzy matching logic with various query strings
    - Test type filter combinations
    - _Requirements: 4.2, 4.3_

- [x] 6. XYFlow canvas with node rendering and edge styling
  - [x] 6.1 Create useCanvasStore for canvas state management
    - Create `sultan-reader/src/stores/useCanvasStore.js` using Zustand
    - State: `nodes` (XYFlow Node[]), `edges` (XYFlow Edge[]), `nodeIdSet` (Set for dedup), `selectedNodeId`
    - Actions: `addNode(id, type, data, position)` — checks nodeIdSet, adds to nodes; `addEdges(edges)`; `setSelectedNode(id)`; `removeNode(id)` — removes node and connected edges
    - _Requirements: 5.3, 5.9_

  - [x] 6.2 Create custom node components for each type
    - Create `sultan-reader/src/components/nodes/EventNode.jsx` — blue border, shows id + text summary
    - Create `sultan-reader/src/components/nodes/RiteNode.jsx` — purple border, shows id + name
    - Create `sultan-reader/src/components/nodes/LootNode.jsx` — gold border, shows id + name
    - Create `sultan-reader/src/components/nodes/AfterStoryNode.jsx` — teal border, shows id + name
    - Create `sultan-reader/src/components/nodes/CardNode.jsx` — green border, shows id + name
    - Create `sultan-reader/src/components/nodes/GenericNode.jsx` — for over/upgrade/dt types, shows id + label
    - Register all as `nodeTypes` map for @xyflow/react
    - _Requirements: 5.1, 5.2_

  - [x] 6.3 Create Canvas component with @xyflow/react
    - Create `sultan-reader/src/components/Canvas.jsx`
    - Render `<ReactFlow>` with nodes/edges from useCanvasStore, register custom nodeTypes
    - Handle drop events from SearchPanel: read transfer data, call `electronAPI.configReadCache(type, id)`, add node via useCanvasStore
    - Support pan, zoom, and manual node dragging
    - _Requirements: 5.1, 5.9_

  - [x] 6.4 Create edgeExtractor service
    - Create `sultan-reader/src/services/edgeExtractor.js`
    - `extractEdges(nodeType, nodeId, data)` → returns array of `{ source, target, path, branchType, conditionText }`
    - Recursively traverse `settlement` arrays, `action.success`, `action.failed`, and nested condition objects
    - Extract from fields: `event_on` → event, `event_off` → event, `rite` → rite, `loot` → loot, `rite_end` → event, `card` → card, `link_card` → card
    - Handle both scalar values (single id) and arrays of ids
    - Determine branchType from JSON path: `success` → 'success', `failed` → 'failed', else → 'default'
    - Attach `__c` comment text as conditionText where available
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 6.5 Implement auto-expand logic with cycle prevention and edge styling
    - When a node is added: call edgeExtractor, count associations
    - **Filter out associations whose target is already in `nodeIdSet`** (prevents infinite loops from cyclic event references like A→B→A)
    - **Auto-expand is single-depth only** — never recursively expand the expanded nodes' associations
    - If filtered associations ≤ 10: auto-load all associated nodes via IPC, add them to canvas with edges
    - If filtered associations > 10: add node in collapsed state, show expansion controls in DetailPanel
    - Edge styling: green stroke for success, red for failed, gray for default
    - On edge click: show floating tooltip with conditionText and comments
    - _Requirements: 5.4, 5.5, 5.6, 5.7_

  - [x] 6.6 Implement automatic layout with dagre (cyclic graph safe)
    - Configure dagre with `acyclicer: 'greedy'` to handle cyclic graphs without errors
    - Apply layout to newly added nodes while preserving manually adjusted positions for existing nodes
    - Re-layout triggered on batch node additions (auto-expand)
    - If dagre produces poor layouts for heavily cyclic subgraphs, consider elkjs as fallback
    - _Requirements: 5.8_

  - [x]* 6.7 Write unit tests for edgeExtractor
    - Test extraction from event data with settlement → action → success/failed → event_on/rite/loot
    - Test extraction from rite data with rite_end
    - Test extraction from upgrade data with link_card
    - Test branchType determination from path
    - _Requirements: 6.1, 6.2, 6.3_

- [ ] 7. Checkpoint — Canvas and search working
  - Ensure search results can be dragged onto canvas, nodes render with correct colors, edges display with correct styling, auto-expand works for small association counts, and dagre layout positions nodes. Ask the user if questions arise.

- [x] 8. Condition parser service
  - [x] 8.1 Create conditionParser service
    - Create `sultan-reader/src/services/conditionParser.js`
    - `parseCondition(key, value, comment, cardsMap)` → returns human-readable string
    - Regex patterns for all condition types:
      - `/^have\.(.+)$/` → "拥有 [卡牌名]" (resolve from cardsMap)
      - `/^!have\.(.+)$/` → "不拥有 [卡牌名]"
      - `/^counter\.(\d+)>=$/` → "计数器 [注释] ≥ 值"
      - `/^counter\.(\d+)<$/` → "计数器 [注释] < 值"
      - `/^counter\.(\d+)=$/` → "计数器 [注释] = 值"
      - `/^counter\+(\d+)$/` → "计数器 [注释] +值"
      - `/^counter-(\d+)$/` → "计数器 [注释] -值"
      - `/^table_have\.(.+)\.(.+)$/` → "表 [表ID] 存在 [字段]"
      - `any` literal → "满足任意一项: [子条件列表]" (recurse)
      - `/^s(\d+)\.is$/` → "卡位 [数字] 是 [卡牌名]"
      - `/^r(\d+):(.+)>=$/` → "检定 [属性] ≥ [阈值]"
    - Priority: `__c` comment text > card name lookup > raw key name
    - `parseConditionObject(conditionObj, cardsMap)` → returns array of parsed condition strings
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10, 11.11_

  - [x]* 8.2 Write unit tests for conditionParser
    - Test each condition pattern with sample data
    - Test `__c` comment priority over raw key
    - Test `any` recursive parsing
    - Test unknown key fallback to raw display
    - _Requirements: 11.1–11.11_

- [x] 9. Image resolver service
  - [x] 9.1 Create imageResolver service
    - Create `sultan-reader/src/services/imageResolver.js`
    - `resolveImage(pic)` → calls `electronAPI.assetResolveImage(pic)`, returns `sultan-asset://` protocol URL or null
    - Actual resolution logic (4-step fallback chain) is in main process IPC handler (task 1.2), returns `sultan-asset://` URL
    - Renderer-side wrapper: if URL returned, use directly as `<img src="sultan-asset://...">` (custom protocol handles file loading securely); if null, display placeholder image
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [x] 10. Detail panels for all node types
  - [x] 10.1 Create DetailPanel container with type dispatch
    - Create `sultan-reader/src/components/DetailPanel.jsx`
    - Listens to `useCanvasStore.selectedNodeId`, loads full node data via `electronAPI.configReadCache`
    - Dispatches to sub-components based on node type: EventDetail, RiteDetail, AfterStoryDetail, CardDetail, LootDetail, OverDetail, UpgradeDetail, DTDetail
    - Includes "查看原始文件" button (shared across all types)
    - _Requirements: 7.5, 8.1_

  - [x] 10.2 Create EventDetail component
    - Create `sultan-reader/src/components/details/EventDetail.jsx`
    - Display event title (text field) with `__c` inline comment
    - Display trigger conditions (condition object) parsed via conditionParser
    - Render each settlement entry: condition with comments, interaction type badge (confirm/option/slide/prompt), result_text/tips_text, success/failed branch details
    - Display images from slide/icon fields via imageResolver
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 10.3 Create RiteDetail component
    - Create `sultan-reader/src/components/details/RiteDetail.jsx`
    - Display rite name and description (text)
    - Render three settlement phases in order: settlement_prior → settlement → settlement_extre
    - Each phase shows conditions (parsed), result text, and actions
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 10.4 Create AfterStoryDetail component
    - Create `sultan-reader/src/components/details/AfterStoryDetail.jsx`
    - Display character name and portrait (pic field → imageResolver)
    - Render each extra entry: condition (parsed), result_text, character portrait if pic present
    - Display `__ca` above-comment as chapter/section heading
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 10.5 Create CardDetail, LootDetail, OverDetail, UpgradeDetail, DTDetail components
    - Create `sultan-reader/src/components/details/CardDetail.jsx`: name, title, text, portrait (resource → imageResolver), tags, rarity
    - Create `sultan-reader/src/components/details/LootDetail.jsx`: name, type, item list (id, type, num, weight per item)
    - Create `sultan-reader/src/components/details/OverDetail.jsx`: ending content indexed by key
    - Create `sultan-reader/src/components/details/UpgradeDetail.jsx`: name, text, effect, conditions (parsed), link_card
    - Create `sultan-reader/src/components/details/DTDetail.jsx`: dialog_tree_id, description, conversation flow with word text, jump_type, options, branching
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x]* 10.6 Write unit tests for detail panel rendering
    - Test EventDetail renders settlement entries correctly
    - Test AfterStoryDetail renders chapter headings from `__ca`
    - Test DTDetail renders conversation flow with branching
    - _Requirements: 7.1–7.5, 9.1–9.3, 10.5_

- [ ] 11. Checkpoint — Detail panels and condition parsing working
  - Ensure clicking a node on canvas opens the correct detail panel, conditions display as human-readable text, images resolve and display (or show placeholder), and settlement entries render correctly. Ask the user if questions arise.

- [x] 12. Main layout wiring
  - [x] 12.1 Create MainLayout component
    - Create `sultan-reader/src/components/MainLayout.jsx`
    - Three-panel layout: SearchPanel (left sidebar), Canvas (center), DetailPanel (right sidebar)
    - Responsive sizing with resizable panels or fixed proportions
    - Load search index on mount via `useConfigStore.buildIndex()`
    - _Requirements: 4.3, 5.1_

- [x] 13. Counter management and player state simulation
  - [x] 13.1 Build counter registry from cached data
    - Extend `useConfigStore` action: `buildCounterRegistry()` — scan all cached files via IPC, extract keys matching `counter.\d+` pattern, collect unique counter IDs with `__c` comment descriptions
    - Store in `counterRegistry` Map: id → { id, comment, defaultValue: 0 }
    - _Requirements: 14.1, 14.2_

  - [x] 13.2 Create usePlayerStore for simulation state
    - Create `sultan-reader/src/stores/usePlayerStore.js` using Zustand with persist middleware
    - State: `triggeredEvents` (Set of event IDs), `counterValues` (Map of counter id → number)
    - Actions: `toggleEvent(id)`, `setCounterValue(id, value)`, `resetAll()`
    - Persist state across application restarts via localStorage or electronAPI.settingsSet
    - _Requirements: 14.3, 15.1, 15.5_

  - [x] 13.3 Create CounterPanel component
    - Create `sultan-reader/src/components/CounterPanel.jsx`
    - Side panel UI listing all registered counters: ID, comment description, editable numeric input for simulated value
    - Section for marking events as triggered: searchable event list with toggle checkboxes
    - _Requirements: 14.4, 15.1_

  - [x] 13.4 Implement condition evaluation and branch highlighting
    - Create `sultan-reader/src/services/conditionEvaluator.js`
    - `evaluateCondition(conditionObj, playerState)` → returns boolean
    - Canvas integration: satisfied edges get full opacity, unsatisfied edges get reduced opacity
    - DetailPanel integration: highlight after_story extra entries whose conditions are satisfied
    - _Requirements: 15.2, 15.3, 15.4_

  - [x]* 13.5 Write unit tests for conditionEvaluator
    - Test counter comparison conditions (>=, <, =)
    - Test have/!have card conditions
    - Test `any` nested conditions
    - Test combined state evaluation
    - _Requirements: 15.2, 15.3_

- [ ] 14. Checkpoint — Counter management and player state working
  - Ensure counter panel displays all extracted counters, simulated values persist, edge highlighting reflects player state, and detail panel highlights satisfied conditions. Ask the user if questions arise.

- [x] 15. AssetStudio integration
  - [x] 15.1 Implement asset extraction IPC handler with safe CLI invocation
    - In `electron/main.js`, implement `asset:extract` handler
    - **Use `child_process.spawn` with array arguments** (NOT string concatenation) to handle paths with spaces/special characters safely:
      ```
      spawn(cliPath, [gameDataPath, resourceDir, '--game', 'Normal', '--types', 'Sprite:Both', '--group_assets', 'ByType', '--image_format', 'Png'])
      ```
    - Run two sequential spawn calls: first for Sprite:Both, then for Texture2D
    - Capture stdout/stderr, send progress events to renderer
    - Validate CLI path exists before execution, return error if not found
    - Handle non-zero exit codes, return error output
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

  - [x] 15.2 Implement .NET runtime detection
    - Implement `asset:checkDotnet` IPC handler: execute `dotnet --list-runtimes`, parse output for .NET 8.0+
    - If `dotnet` command not found or .NET 8.0 not installed, return `{ available: false }`
    - SettingsPage calls this on mount and when AssetStudio CLI path is set, displays clear warning if .NET 8.0 is missing (instead of letting AssetStudio silently fail)
    - _Requirements: 13.4_

  - [x] 15.3 Update SettingsPage with extraction progress UI and .NET status
    - Show progress indicator / log output while AssetStudio CLI is running
    - Display error messages for invalid CLI path or extraction failures
    - **Show .NET 8.0 runtime status indicator** — green check if available, red warning with install instructions if missing
    - _Requirements: 13.3, 13.4, 13.5_

- [x] 16. Raw file comparison view
  - [x] 16.1 Create RawFileView component
    - Create `sultan-reader/src/components/RawFileView.jsx`
    - Triggered by "查看原始文件" button in DetailPanel
    - Calls `electronAPI.fileReadRaw(sourcePath)` using `_source_path` from cache metadata
    - Display raw file content with syntax highlighting for comments (`//` and `/* */`)
    - Visually annotate positions where duplicate keys were merged
    - Annotate where comments were inlined as `__c`/`__ca`/`__ci` fields
    - _Requirements: 16.1, 16.2, 16.3_

- [x] 17. Performance optimizations for large files
  - [x] 17.1 Implement virtualized rendering for large detail content
    - For files exceeding 1000 lines (e.g. after_story/2000001.json with 1407 lines), use virtualized list or paginated rendering in DetailPanel
    - Ensure search index construction completes within 5 seconds for ~2934 files
    - Verify large single-file objects (cards.json ~27000 lines) are cached as single entries under `cache/single/`
    - _Requirements: 17.1, 17.2, 17.3_

- [ ] 18. Final checkpoint — Full integration
  - Ensure all features work end-to-end: settings → cache rebuild → search → drag to canvas → auto-expand → detail panels → condition parsing → image display → counter management → player state highlighting → raw file view. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The parser layer (`commentStripper.js`, `gameConfigParser.js`, `cacheManager.js`) at `sultan-reader/electron/parser/` is already complete — tasks integrate it, not recreate it
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- The 8 node types are: event, rite, loot, after_story, card, over, upgrade, dt

### 关键技术防范措施（已融入任务）

1. **本地图片安全加载**：通过 `sultan-asset://` 自定义协议加载，不关闭 `webSecurity`（任务 1.2）
2. **IPC 序列化性能**：搜索逻辑在 Main Process 执行，Renderer 只发送关键字、接收少量结果（任务 1.2, 5.1, 5.2）
3. **循环引用防死循环**：自动展开使用 `nodeIdSet` 作为 Visited Set，仅展开一层深度；dagre 配置 `acyclicer: 'greedy'`（任务 6.5, 6.6）
4. **CLI 路径安全**：`child_process.spawn` 使用数组参数；增加 .NET 运行时探测（任务 15.1, 15.2）
5. **缓存版本化**：`_parser_version` 字段确保解析器升级后旧缓存自动失效（任务 1.4）
