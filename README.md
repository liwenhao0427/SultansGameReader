# 苏丹的游戏本地剧情阅读器

一个面向《苏丹的游戏》的本地剧情阅读器项目。它不追求完整复刻游戏系统，而是优先服务“快速阅读剧情、查看幕后关系、浏览仪式分支、联动图片资源”这件事。

## 快速入口

- [使用说明文档（含界面截图）](./使用说明/苏丹的游戏阅读器使用说明%20V0.8.md)
- [项目需求稿](./sultan-reader-spec.md)
- [协作约束](./Agents.md)

当前仓库的核心可开发目录是 `sultan-reader/`，项目以 Electron + React + Vite 构建，前端只依赖 `cache/` 和 `resource/`，不直接解析原始 `config/`。

## 项目目标

- 以“剧情阅读器”而不是“完整模拟器”为方向
- 重点支持仪式、幕后、后日谈、结局等叙事内容
- 用节点图梳理触发关系，用类视觉小说界面承载正文阅读
- 尽可能展示游戏内图片、装饰板和卡牌资源
- 条件、计数器、卡牌槽位等机制只保留到“帮助理解剧情分支”的程度

## 当前实现概览

当前应用已经具备可运行的桌面端阅读器骨架，主要能力包括：

- 设置页
  - 配置游戏目录
  - 配置 `AssetStudio.CLI.exe`
  - 配置缓存目录与资源目录
  - 重建配置缓存、提取资源、清空缓存、清空阅读状态
  - 检测本机 `.NET 8` 运行时
- 主界面
  - 左侧内容目录，支持按类型切换：仪式、幕后、战利品、结局、后日谈、卡牌、对话树
  - 关键字筛选
  - 已读 / 未读 / 收藏状态过滤
  - 条目快速标记已读
- 节点图
  - 点击条目后挂载到画布
  - 自动展开部分关联节点
  - 中央画布用于查看剧情连接关系
- 阅读详情
  - 右侧详情面板支持卡牌、幕后、仪式、后日谈、结局、对话树等类型
  - 可查看原始配置文件内容
  - 支持已读、收藏状态切换
- 全屏阅读器
  - `rite / event / dt / over / after_story` 支持更完整的沉浸式阅读视图
  - 仪式支持槽位候选、条件切换、对白展示、手动进入结算
  - 成功 / 失败分支支持手动选择，符合“阅读器优先，不做真实数值计算”的目标
- 资源与数据支持
  - 主进程内置配置缓存索引与内容名称映射
  - 图片解析兼容 `.png` 与 `.png.png`
  - 自定义 `sultan-asset://` 协议安全加载本地资源
  - 阅读状态与内容名称映射会持久化保存

## 技术栈

- Electron
- React 18
- Vite
- Zustand
- `@xyflow/react`
- dagre
- Vitest

## 数据流

项目采用“主进程解析，前端消费缓存”的方式：

1. 用户在设置页选择游戏目录
2. Electron 主进程读取游戏 `config/`
3. 解析器将结果写入 `cache/`
4. 用户通过 AssetStudio 提取图片资源到 `resource/`
5. 前端从 `cache/` 和 `resource/` 加载内容并展示

这也是项目的重要约束：渲染层不直接依赖原始配置目录。

## 主要目录说明

```text
SultansGameReader/
├─ sultan-reader/                # 主应用（允许开发）
│  ├─ electron/                  # Electron 主进程、preload、解析器
│  ├─ src/                       # React 前端
│  ├─ build/                     # 图标等构建资源
│  └─ package.json
├─ cache/                        # 配置缓存（前端读取）
├─ resource/                     # 图片资源（前端读取）
├─ 相关知识/                      # 字段语义文档，只读参考
├─ Agents.md                     # 协作约束
└─ README.md
```

只读参考目录：

- `AssetStudio-net8.0-win/`
- `config/`
- `resource/`
- `sudans-game-reader/`
- `相关知识/`

主要开发目录：

- `sultan-reader/`
- `Agents.md`

## 关键模块

### 1. Electron 主进程

入口文件：`sultan-reader/electron/main.js`

负责：

- 创建桌面窗口
- 暴露 IPC 接口
- 维护搜索索引
- 管理设置持久化
- 调用配置解析器
- 调用 AssetStudio CLI
- 注册 `sultan-asset://` 协议

### 2. 配置解析器

目录：`sultan-reader/electron/parser/`

负责把游戏配置解析为缓存文件，供前端直接读取。项目文档中明确提到它支持：

- 注释保留
- 非标准 JSON 兼容
- 增量缓存

### 3. 前端主界面

关键文件：

- `sultan-reader/src/App.jsx`
- `sultan-reader/src/components/MainLayout.jsx`
- `sultan-reader/src/components/DetailPanel.jsx`
- `sultan-reader/src/components/reader/StoryInspector.jsx`

职责分工：

- `App.jsx` 决定首次进入设置页还是主界面
- `MainLayout.jsx` 负责内容目录、筛选、画布和详情入口
- `DetailPanel.jsx` 负责侧边详情阅读
- `StoryInspector.jsx` 负责全屏阅读器与仪式阅读流程

### 4. 状态管理

目录：`sultan-reader/src/stores/`

目前主要包含：

- 配置与索引状态
- 画布状态
- 阅读状态
- 玩家模拟相关状态

## 已支持的内容类型

从当前代码来看，已经支持以下主要内容类型的索引或阅读：

- 仪式 `rite`
- 幕后 `event`
- 战利品 `loot`
- 结局 `over`
- 后日谈 `after_story`
- 卡牌 `card`
- 对话树 `dt`

## 图片加载规则

主进程会根据资源名进行多级回退，兼容 AssetStudio 的双后缀产物。当前逻辑会尝试：

1. `Texture2D/{name}.png`
2. `Texture2D/{name}.png.png`
3. `Sprite/{name}.png`
4. `Sprite/{name}.png.png`

个别资源有特判，例如 `rite_1` 会优先匹配 `Sprite/rite_1.png.png`。

## 本地开发

运行环境建议：

- Node.js 18+
- npm
- Windows
- `.NET 8` 运行时

进入应用目录：

```bash
cd sultan-reader
```

安装依赖：

```bash
npm install
```

启动前端开发服务器：

```bash
npm run dev
```

另开一个终端启动 Electron：

```bash
npm run electron:dev
```

执行测试：

```bash
npm test
```

构建前端：

```bash
npm run build
```

打包 Windows 目录版：

```bash
npm run pack:win
```

## 使用流程

首次使用建议按下面顺序操作：

1. 打开设置页
2. 配置游戏安装目录
3. 确认 `AssetStudio.CLI.exe` 路径
4. 点击“更新配置缓存”
5. 点击“提取游戏资源”
6. 返回主界面，按内容类型浏览并阅读

## 当前实现特点

- 明显偏向“阅读体验”而不是“系统模拟”
- 仪式阅读器已经开始支持卡槽、候选卡牌和分支推进
- 已读 / 收藏 / 内容筛选已经形成基础闭环
- 支持查看原始配置文件，方便核对数据来源
- 主进程承担大量数据准备工作，前端读取更轻量

## 开发约束摘要

项目协作时需要特别注意：

- 所有沟通、注释、文档统一使用中文
- 读取和写入文件统一使用 UTF-8
- 不在渲染层直接解析 `config/`
- 图片查找必须兼容 `.png` 和 `.png.png`
- 资源常量统一放在配置文件中维护，不在组件内散落硬编码
- 涉及字段语义调整时，应先查看 `相关知识/`

## 参考文档

- 项目需求稿：`sultan-reader-spec.md`
- 协作约束：`Agents.md`
- 字段语义参考目录：`相关知识/`

## 仓库地址

[GitHub - liwenhao0427/SultansGameReader](https://github.com/liwenhao0427/SultansGameReader)

## 支持作者

如果这个工具对你有帮助，欢迎支持作者继续完善阅读器。

<img src="sultan-reader/src/assets/donate-support.jpeg" alt="支持作者开发" width="220" />
