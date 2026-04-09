# 苏丹的游戏配置 JSON 格式规范（面向本地剧情阅读器）

本文档基于以下资料整理：

- `D:\SultansGameReader\相关知识\配置json含义说明.md`
- `D:\SultansGameReader\cache\event\*.json`
- `D:\SultansGameReader\cache\rite\*.json`
- `D:\SultansGameReader\cache\loot\*.json`
- `D:\SultansGameReader\cache\after_story\*.json`
- `D:\SultansGameReader\cache\dt\*.json`
- `D:\SultansGameReader\cache\single\cards.json`
- `D:\SultansGameReader\cache\single\over.json`
- `D:\SultansGameReader\cache\single\upgrade.json`
- `D:\SultansGameReader\cache\single\tag.json`

目标不是还原游戏全部内部机制，而是为当前阅读器提供一份“足够准确、可直接指导渲染实现”的格式规范。

---

## 一、总览

游戏配置并不是标准 JSON / JSON5，而是策划自定义格式。当前项目已经通过解析器把它们转成了可消费的缓存 JSON。对于阅读器来说，最重要的不是“原始文件怎么写”，而是“缓存中这些字段代表什么”。

从阅读器视角看，全部配置可以拆成两层：

1. **配置类型层**
   - `event`：弹窗事件、选项事件、触发器事件
   - `rite`：仪式 / 地图玩法 / 卡槽玩法主节点
   - `loot`：掉落池
   - `after_story`：结局补充片段 / 后日谈片段集
   - `dt`：对话树
   - `card`：卡牌定义
   - `over`：结局主文案
   - `upgrade`：成长 / 商店项目
   - `tag`：标签、属性、状态元数据

2. **规则语言层**
   - `condition`：显示/触发条件
   - `result`：执行后的结果描述对象
   - `action`：跳转、触发、开启下一节点
   - `choose`：可视为“对话/分支选项池”
   - `pic / resource / bg / icon`：资源引用

也就是说，不同配置类型长得不一样，但它们很多都共享同一套规则语言。

---

## 二、缓存文件通用结构

大部分缓存文件都有以下元字段：

```json
{
  "_source_path": "config\\rite\\5000001.json",
  "_cached_at": 1775701643234,
  "_source_mtime": 1750986718660.3772,
  "_parse_error": null
}
```

字段说明：

- `_source_path`：原始配置相对路径
- `_cached_at`：缓存生成时间
- `_source_mtime`：原始文件修改时间
- `_parse_error`：解析失败时的错误信息

阅读器展示时通常应忽略这些元字段。

---

## 三、注释保留字段

解析器没有简单丢弃注释，而是把注释保留下来：

- `__c`：单字段注释
- `__ca`：块级或区域注释
- `__ci`：内联注释

例如：

```json
{
  "type": 2,
  "type__c": "2 普通权重, 3 维新 99是loot内全部掉落"
}
```

这些字段非常适合作为“开发者提示”“原始备注”“调试模式附加说明”，但不建议默认展示给普通用户。

---

## 四、规则语言总则

### 4.1 `condition`

`condition` 是最核心的条件表达式容器，键名本身就是语法。

常见模式：

- `have.<卡牌ID或标签>`：拥有某卡牌/某标签
- `!have.<卡牌ID或标签>`：不拥有
- `counter.<ID>>=` / `counter.<ID><` / `counter.<ID>=`
- `global_counter.<ID>>=`：全局计数器判断
- `s1.is` / `s2.is` / `s3.is`：某卡槽放入指定卡
- `s4.空屋`：某卡槽对象具备指定标签/字段
- `table_have.<对象>.<字段>`：表中存在某字段值
- `r1:智慧+社交>=`：某次检定达到阈值
- `f:智慧+社交>=`：卡牌/角色自身属性判断
- `any`：任一成立
- `all`：全部成立
- `!s1`：某槽为空或不存在对应对象

重要结论：

- `condition` 不是纯展示文本，而是**分支门槛定义**。
- 对阅读器来说，`condition` 应优先转换成人类可读文本，作为“分支条件说明”“结果触发条件说明”。
- 同一个 `condition` 下可能同时混合槽位条件、卡牌条件、计数器条件、属性检定条件。

### 4.2 `result`

`result` 描述执行后的状态变化，不一定直接等于“跳转”。

常见键：

- `card`：获得卡牌
- `loot`：获得掉落池
- `金币` / `coin`：金币变化
- `counter+7000001` / `counter-7000001` / `counter=7000001`
- `global_counter+xxxx`
- `clean.s4`：清空槽位
- `s4+回收`：把槽位内容回收到某处
- `choose`：生成后续可选台词或候选分支

重要结论：

- `result_text` 是玩家能直接读到的叙事文本。
- `result` 是状态变化说明，更像“结算数据”。
- 阅读器在视觉小说模式下应以 `result_title + result_text` 为主，把 `result` 作为“结果摘要”或“调试信息”。

### 4.3 `action`

`action` 更像真正的“流程推进器”。

常见键：

- `event_on`：触发事件
- `event_off`：关闭事件
- `rite`：触发仪式
- `rite_end`：仪式结束后触发事件
- `over`：进入某结局
- `confirm`：弹出确认框
- `success` / `failed`：检定成功/失败分支
- `choose`：注入可选台词

重要结论：

- 对节点图来说，`action` 决定 edge。
- 对右侧叙事来说，`action.success / action.failed` 决定分支按钮。
- 纯 `action` 而没有正文文本的 `event`，更适合作为“流程中转器”而不是正文节点。

### 4.4 `choose`

`choose` 在当前阅读器里应该被视为“可点击选项集合”，而不是简单文本。

它常见于两类地方：

1. `result.choose`
2. `cards_slot.*.pops[*].action.choose`

典型例子：

```json
{
  "choose": {
    "pop.5000001_01.self": "唔……今天的菜单……",
    "pop.5000001_02.self": "招待客人的菜肴都准备好了"
  }
}
```

阅读器建议解释为：

- key：选项内部 ID / 语音 ID / 条件化话术 ID
- value：玩家实际看到的台词文本

---

## 五、各配置类型规范

## 5.1 `event`

### 结构特征

`event` 是弹窗式事件，通常至少包含：

- `id`
- `text`
- `is_replay`
- `auto_start`
- `on`
- `condition`
- `settlement`

示例结构：

```json
{
  "id": 5300000,
  "text": "开场介绍",
  "on": {
    "round_begin_ba": 1
  },
  "condition": {},
  "settlement": [
    {
      "tips_text": "",
      "action": {
        "confirm": {},
        "success": { "event_on": [5300300] },
        "failed": { "event_on": 5300066 }
      }
    }
  ]
}
```

### 关键字段含义

- `text`：事件标题或主文本入口
- `on`：事件挂载触发点
- `condition`：全局触发前置条件
- `settlement`：事件交互与结算主体
- `tips_resource / tips_text`：提示性 UI 文本

### `settlement` 子项常见结构

- `condition`：该条结算成立条件
- `result_title`：结果标题
- `result_text`：结果正文
- `result`：状态变化
- `action`：后续跳转

### 对阅读器的意义

- 有 `text` / `result_text` 的 `event` 可以当成正文节点。
- 只有 `action.event_on / action.rite`，没有实际正文的 `event`，建议不单独显示为画布节点，而是转译为 edge 说明。
- `action.success / action.failed` 需要显示成明确分支按钮。

---

## 5.2 `rite`

### 结构特征

`rite` 是当前项目最重要的主玩法节点，既有固定说明，也有每回合结算、卡槽、扩展结算。

常见字段：

- `id`
- `name`
- `text`
- `round_number`
- `waiting_round`
- `location`
- `icon`
- `tag_tips`
- `tips_text`
- `open_conditions`
- `random_text`
- `settlement_prior`
- `settlement`
- `settlement_extre`
- `cards_slot`

### 关键字段含义

- `text`：仪式主描述，通常应始终展示
- `round_number`：执行回合数
- `waiting_round`：等待回合数
- `location`：地点
- `tag_tips`：建议属性标签
- `tips_text`：玩法说明
- `random_text`：随机提示/描述文本
- `settlement_prior`：优先结算，通常是抢先判定的特殊分支
- `settlement`：主结算
- `settlement_extre`：额外结算/补充分支
- `cards_slot`：卡槽定义

### `settlement_prior / settlement / settlement_extre`

三者结构相似，都是条件分支列表。每一项通常包含：

- `condition`
- `result_title`
- `result_text`
- `result`
- `action`

其中：

- `settlement_prior`：优先判定，中断性强，适合最先显示
- `settlement`：主流程核心分支
- `settlement_extre`：附加收益、附加剧情、场景补充分支

### `cards_slot`

这是仪式区别于普通 `event` 的关键字段。

典型结构：

```json
{
  "s1": {
    "condition": {
      "type": "char",
      "贵族": 1
    },
    "open_adsorb": 0,
    "is_key": 0,
    "is_empty": 1,
    "is_enemy": 0,
    "text": "你需要一位贵族出面打理各种事务。",
    "pops": []
  }
}
```

字段说明：

- `s1 / s2 / s3 / s4`：卡槽 ID
- `condition`：该槽允许放入什么对象
- `open_adsorb`：是否允许吸附/自动吸附
- `is_key`：是否关键槽
- `is_empty`：是否可空
- `is_enemy`：是否敌方槽
- `text`：槽位说明
- `pops`：放入某卡后可触发的候选台词/选项

### `cards_slot.*.pops`

这是非常适合视觉小说化的一层。

每条 `pop` 通常包含：

- `condition`：该候选文本成立条件
- `action.choose`：实际展示的候选台词

它的含义更接近：

- “如果当前卡槽放入了满足条件的卡，就提供这些对应台词或互动选项。”

### 对阅读器的意义

- `rite.text` 应作为节点进入右侧详情时默认展示的首段正文。
- `settlement_prior`、`settlement`、`settlement_extre` 都应被解释为“可展开的后续剧情分支”。
- `cards_slot` 应转成“槽位说明 + 可触发角色台词/互动选项”。
- `action.rite` 是后续仪式连接，`action.event_on` 是事件连接。

这也支持你提出的目标：**仪式默认不展开，点击后右侧先展示基础文本，再逐次推进到条件分支、选项、后续节点。**

---

## 5.3 `loot`

`loot` 是掉落池，不是叙事节点。

典型结构：

```json
{
  "id": 6000004,
  "name": "情报掉落",
  "repeat": 1,
  "type": 2,
  "item": [
    {
      "num": "1",
      "id": "2000032",
      "type": "card",
      "weight": 60
    }
  ]
}
```

字段说明：

- `name`：掉落池名称
- `repeat`：是否可重复
- `type`：掉落池分类/权重类型
- `item[]`：具体条目
- `item.id`：掉落对象 ID
- `item.type`：通常为 `card`
- `item.num`：数量
- `item.weight`：权重

对阅读器的意义：

- `loot` 更适合做右侧表格/列表，不适合作为长剧情正文。
- 节点图中可以作为“资源节点”存在。

---

## 5.4 `after_story`

`after_story` 是后日谈 / 结局补充片段集，本质上是“满足条件后依次展示的片段列表”。

常见字段：

- `id`
- `name`
- `prior`
- `extra`

其中真正重要的是 `extra[]`：

```json
{
  "key": "2000001_extra_12",
  "sort": 3,
  "pic": "cards/2000899",
  "condition": {
    "counter.7000550>=": 1
  },
  "result_text": "人们把你的故事编成了脍炙人口的歌谣……"
}
```

字段说明：

- `key`：片段唯一键
- `sort`：排序值，越小通常越先显示
- `pic`：插图
- `condition`：片段出现条件
- `result_text`：正文

对阅读器的意义：

- `after_story` 非常适合直接做成视觉小说模式的连续片段。
- 同一个 `after_story` 节点右侧可以按 `sort` 排序后分页或逐段显示。
- `pic` 很适合配图。

---

## 5.5 `dt`

`dt` 是标准对话树。

典型结构：

```json
{
  "dialog_tree_id": "DT1",
  "first_word_id": "S1",
  "description": "魔法师交谈1-什么是苏丹的游戏",
  "Item": [
    {
      "word_id": "S1",
      "word": "这是一个只有王者才能玩的游戏……",
      "jump_type": "0",
      "direct_id": "S2",
      "Option": [],
      "action": {}
    }
  ]
}
```

字段说明：

- `dialog_tree_id`：对话树 ID
- `first_word_id`：起始节点
- `description`：描述
- `Item[]`：对话节点列表
- `word_id`：当前对话句 ID
- `word`：文本
- `jump_type`：跳转模式
- `direct_id`：直接跳转目标
- `Option[]`：选项列表
- `action`：额外行为

对阅读器的意义：

- `dt` 应作为真正的“视觉小说式对话树”渲染。
- `jump_type=1` 配合 `Option[]` 时，可直接显示选项按钮。
- `jump_type=0` / `3` 更像自动继续或终止。

---

## 5.6 `cards.json`

`cards.json` 是全量卡牌字典，键是卡牌 ID。

典型结构：

```json
{
  "2000006": {
    "id": 2000006,
    "name": "梅姬",
    "title": "你的妻子",
    "text": "你的妻子……",
    "type": "char",
    "rare": 2,
    "resource": ["cards/2000006", "cards/2000006_1"],
    "tag": {
      "智慧": 2,
      "妻子": 1
    }
  }
}
```

关键字段：

- `name`：卡名
- `title`：副标题
- `text`：卡牌说明
- `type`：`char / item / sudan ...`
- `rare`：稀有度
- `resource`：立绘或卡图资源，可为字符串或数组
- `destroy_resources`：销毁/大图资源
- `tag`：属性与标签集合
- `equips`：可装备槽位
- `is_only`：是否唯一
- `post_rite`：某些卡附带仪式后处理逻辑

对阅读器的意义：

- 几乎所有 `have.xxx`、`card`、`link_card`、`pic` 都要靠它做名称映射和资源映射。
- `resource` 必须兼容字符串和数组两种情况。
- `tag` 既用于展示，也用于条件解释。

---

## 5.7 `over.json`

`over` 是结局正文库，键通常是结局 ID。

常见字段：

- `name`
- `sub_name`
- `success`
- `text`
- `text_extra`
- `open_after_story`
- `bg`
- `icon`
- `title`
- `manual_prompt`

其中：

- `text`：主结局正文
- `text_extra[]`：额外条件化补充段落
- `success`：结局评级
- `open_after_story`：是否继续开启后日谈
- `bg / icon / title`：结局资源

对阅读器的意义：

- `over` 应视为完整结局页面，不只是普通节点。
- 如果 `open_after_story=1`，可以在结局之后衔接 `after_story` 内容。

---

## 5.8 `upgrade.json`

`upgrade` 是成长/商店条目定义。

常见字段：

- `id`
- `name`
- `text`
- `cost`
- `condition`
- `icon`
- `link_card`
- `effect`
- `incompatible`

其中：

- `condition.unlock_upgrade`：前置成长
- `link_card`：关联展示卡牌
- `effect`：购买后获得的实际效果
- `incompatible`：互斥项

对阅读器的意义：

- 主要用于说明性展示，不是主剧情节点。
- `link_card` 很适合右侧联动卡牌详情。

---

## 5.9 `tag.json`

`tag` 是属性和标签元数据表。

常见字段：

- `id`
- `name`
- `code`
- `type`
- `text`
- `resource`
- `can_add`
- `can_visible`
- `can_inherit`
- `attributes`

对阅读器的意义：

- 它是条件解释器的重要底表。
- `name + text` 可以帮助把诸如 `贵族 / 妻子 / 装备 / 情报` 等标签解释成人类语言。
- `resource` 还可用于标签图标展示。

---

## 六、资源字段规范

### 6.1 常见资源字段

- `pic`
- `resource`
- `destroy_resources`
- `bg`
- `icon`
- `title`

### 6.2 解析规则

项目已知图片查找顺序应为：

1. `resource/Sprite/{name}.png`
2. `resource/Sprite/{name}.png.png`
3. `resource/Texture2D/{name}.png`
4. `resource/Texture2D/{name}.png.png`

例如：

- `cards/2000001`
- `cards/yrl`
- `over_cg/over_cg_1`

都应把最后一段文件名抽出来尝试匹配资源。

### 6.3 阅读器建议

- 节点卡片上展示缩略图
- 右侧详情优先展示大图
- `resource` 为数组时可以做轮播或变体切换

---

## 七、面向阅读器的渲染建议

## 7.1 哪些对象应当成为画布节点

建议直接建节点：

- `rite`
- 有正文内容的 `event`
- `loot`
- `after_story`
- `card`
- `over`
- `upgrade`
- `dt`

建议不直接建正文节点，只转 edge 或内嵌提示：

- 只有 `action.event_on / action.rite / event_off`、没有 `text / result_text` 的触发器型 `event`

这和你的预期一致：**纯触发器不进画布正文，只作为流程连接。**

## 7.2 节点默认折叠策略

对 `rite / event` 节点建议默认只显示：

- 名称
- 类型中文名
- 一张缩略图
- 一句摘要

不在节点卡片里直接展开所有 `settlement`。

## 7.3 右侧详情面板推进策略

建议把右侧面板分成以下顺序：

1. 基础信息
   - 名称、类型、图片、位置、标签
2. 开场正文
   - `rite.text`
   - `event.text`
   - `dt.Item[first].word`
3. 当前可选分支
   - `settlement_prior`
   - `settlement`
   - `cards_slot.*.pops`
   - `dt.Option`
4. 结果预览
   - `result_title`
   - `result_text`
   - 条件说明
5. 后续节点
   - `action.event_on`
   - `action.rite`
   - `action.loot`
   - `action.over`

## 7.4 视觉小说模式的最小单位

建议把以下对象统一抽象成“叙事片段”：

- `text`
- `result_text`
- `word`
- `text_extra[*].result_text`
- `after_story.extra[*].result_text`

每个片段可携带：

- `speaker`：没有时可为空
- `image`
- `conditionText`
- `options`
- `nextRefs`

这样 `event / rite / dt / after_story / over` 都能进入同一套叙事渲染器。

## 7.5 分支按钮生成原则

按钮来源应包括：

- `action.success`
- `action.failed`
- `result.choose`
- `cards_slot.*.pops[*].action.choose`
- `dt.Option`

按钮文案优先级建议：

1. 实际 `choose` 文本
2. `option_Jump_word`
3. 条件转义文本
4. 默认“继续”

---

## 八、面向当前项目的关键结论

### 8.1 你提出的几条判断基本成立

1. `event` 确实有一部分只是触发器，不该都画成正文节点。
2. `rite.text` 基本就是仪式节点的稳定开场文本。
3. `settlement` 才是仪式真正的分支主体，且经常带 `condition`、`result_text`、`action`、`choose`。
4. `cards_slot.pops` 是仪式中“放不同卡出现不同台词/选项”的关键结构。
5. `after_story` 不是单结局，而是按条件筛出的片段集合。

### 8.2 当前阅读器后续实现最该优先支持的字段

第一优先级：

- `text`
- `result_text`
- `condition`
- `action`
- `choose`
- `cards_slot`
- `pic / resource`

第二优先级：

- `tips_text`
- `tag_tips`
- `random_text`
- `text_extra`
- `link_card`

第三优先级：

- 注释字段 `__c / __ca / __ci`
- 各类调试型计数与元信息

### 8.3 一句话总结数据模型

可以把整个游戏配置理解为：

**“以 `rite / event / dt / over / after_story` 为叙事外壳，以 `condition + result + action + choose` 为流程语言，以 `cards / tag / resource` 为解释与展示底表。”**

---

## 九、建议的前端抽象模型

为了支撑你要的节点图 + 视觉小说混合模式，建议前端统一抽象成下面这几种实体：

### 9.1 StoryNode

```json
{
  "id": "rite:5000001",
  "type": "rite",
  "title": "治理家业",
  "summary": "人们仍然愿意来到你的屋檐下……",
  "image": "cards/...",
  "hasContent": true
}
```

### 9.2 StorySegment

```json
{
  "id": "rite:5000001:settlement:1",
  "sourceNodeId": "rite:5000001",
  "conditionText": "若智慧+社交检定达到 3/5",
  "title": "",
  "text": "金币碰撞的声音令你微笑……",
  "options": [],
  "nextRefs": ["rite:5000001"]
}
```

### 9.3 StoryOption

```json
{
  "id": "pop.5000001_result_01_1.妻子",
  "text": "一切都会好起来的",
  "conditionText": "需要妻子相关分支",
  "nextRefs": []
}
```

---

## 十、后续可直接推进的开发任务

基于这份规范，后续实现可以直接拆成：

1. 做统一的“配置转故事节点”适配层
2. 过滤掉纯触发器型 `event`
3. 给 `rite/event/dt/after_story/over` 抽统一的右侧叙事片段格式
4. 给 `condition/result/action/choose` 做统一的人类可读解释器
5. 把 `cards.json + tag.json + resource/` 接进展示层

如果后续继续推进实现，建议优先从 `rite` 和 `event` 两类开始，因为它们覆盖了你目前最在意的节点图和逐步阅读体验。
