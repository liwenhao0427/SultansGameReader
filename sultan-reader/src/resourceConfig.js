/**
 * 阅读器资源配置
 *
 * 约束：
 * 1. 资源名统一在这里维护，避免组件内散落硬编码。
 * 2. 这里只配置前端允许直接引用的 resource 资源 key，不在渲染层解析 config。
 * 3. 所有字段都保留中文注释，方便后续继续补齐阅读器素材。
 */

/**
 * 卡牌稀有度背景映射。
 *
 * 当前卡牌数据中的 rare 取值为 1~4，共四档：
 * 1 = 石质
 * 2 = 铜质
 * 3 = 银质
 * 4 = 金质
 *
 * 这里使用完整卡牌底板 `card_bg_*`，而不是旧的 `rare_*` 小徽记资源，
 * 这样能和游戏内卡牌外框更接近，也能修正当前背景显示不对的问题。
 */
export const CARD_RARITY_FRAME_ASSETS = {
  1: 'card_mt',
  2: 'copper',
  3: 'silver',
  4: 'gold',
}

/**
 * 阅读器界面使用到的固定资源。
 *
 * 说明：
 * - asset 字段是传给 `useResolvedImage/assetResolveImage` 的资源 key。
 * - 这里优先收纳“资源常量”，尺寸、定位等纯样式数值仍可放在各自布局配置中。
 */
export const READER_RESOURCE_ASSETS = {
  noteBackground: 'note_bg_new',
  titleEmblem: 'nomal_rite_bg',
  defaultRiteBackground: 'nomal_rite_bg',
  // 仪式节点默认图标。
  // 回退规则：当仪式自身 icon 缺失或对应资源未导出时，统一使用 rite_0 兜底，避免节点左侧出现黑块。
  defaultRiteNodeIcon: 'rite_0',
  // 节点图背景地图。
  // 优先使用桌面地图底图，给节点画布提供固定的叙事氛围背景。
  nodeMapBackground: 'table-map',
  settlementBackground: 'settlement_bg',
  settlementDiceBackground: 'settlement_bg_dice',
  riteTitlePlate: 'rite_title_bg',
  riteTitleLine: 'rite_title_short',
  slotFrame: 'nomal_slot_bg',
  // 固定卡槽锁定装饰。
  // 用于 `is_empty = 0` 且槽位条件已经限定为固定卡牌时，在槽位中央额外显示锁定提示。
  // 回退规则：找不到时不显示，不影响原有卡槽内容。
  slotLocked: 'slot_locked',
  dialogueFrame: '1-3',
}

/**
 * 事件阅读器固定回退配置。
 *
 * 说明：
 * - 事件正文没有显式 icon 或相关贴图时，右下角回退显示主角卡牌。
 * - 这里只维护“阅读器展示层”用到的固定默认值，避免组件里直接硬编码卡牌 id。
 */
export const EVENT_READER_DEFAULTS = {
  fallbackCharacterCardId: '2000001',
}

/**
 * 后日谈角色默认立绘映射。
 *
 * 说明：
 * - 后日谈有一部分条目不会显式写 `pic`，但阅读器仍然需要展示固定角色立绘。
 * - 这里优先使用明确的角色资源，而不是模糊匹配 cards.json，避免把“妻子”“主角”错映射成别的卡面。
 * - key 允许写多个同义名，比较时会做去标点和空白的标准化。
 */
export const AFTER_STORY_CHARACTER_DEFAULTS = {
  妻子: {
    image: '1_char_5',
    rare: 3,
  },
  梅姬: {
    image: '1_char_5',
    rare: 3,
  },
  主角: {
    image: '1_char_7',
    rare: 3,
  },
  阿尔图: {
    image: '1_char_7',
    rare: 3,
  },
}

/**
 * 卡牌展示比例与裁切规则。
 *
 * 原始卡牌底板采用 194 x 422 的纵向长比例。
 * 展示规则：
 * 1. 默认尽量完整显示整张卡牌；
 * 2. 缩略图空间不足时，也优先保留上半部分，不从中间截断。
 */
export const CARD_RENDER_CONFIG = {
  frameWidth: 194,
  frameHeight: 422,
  imageObjectFit: 'contain',
  imageObjectPosition: 'top center',
}

/**
 * 仪式模板默认配置。
 * 没有 mapping_id 时回退到默认模板，保证背景和槽位布局始终可展示。
 */
export const RITE_TEMPLATE_DEFAULTS = {
  id: '8000001',
  background: 'nomal_rite_bg',
}

/**
 * 固定苏丹卡槽位素材。
 *
 * 这些需求不是普通 cards.json 卡牌，而是仪式槽位里直接写在 condition 中的固定苏丹卡。
 * `image` 使用 resource/Texture2D 下的图片名，`rare` 继续走统一稀有度背景。
 */
export const FIXED_SUDAN_SLOT_ASSETS = {
  杀戮: {
    name: '杀戮',
    image: '2010001',
  },
  纵欲: {
    name: '纵欲',
    image: '2010005',
  },
  奢靡: {
    name: '奢靡',
    image: '2010009',
  },
  征服: {
    name: '征服',
    image: '2010013',
  },
}

/**
 * 固定物品槽位素材。
 * 目前先支持金币，后续如果有更多固定物品要求，也统一加在这里。
 */
export const FIXED_ITEM_SLOT_ASSETS = {
  金币: {
    name: '金币',
    image: '2000029',
  },
}

/**
 * 固定 tag → 卡牌 id 映射。
 *
 * 某些条件里直接用 tag 名（如 "主角": 1、"妻子": 1）指代固定卡牌，
 * 这里维护 tag → cards.json 中对应卡牌 id 的映射，
 * 供 storyAdapter 在解析条件时直接展示对应卡牌图片。
 *
 * 回退规则：tag 不在此表中时，走普通条件文本展示。
 */
export const FIXED_TAG_CARD_IDS = {
  // 主角：阿尔图（2000001）
  主角: '2000001',
  // 妻子：梅姬（2000006）
  妻子: '2000006',
}

/**
 * 根据稀有度读取卡牌底板资源。
 * 未知稀有度时回退到最低档，保证界面始终有卡牌背景可显示。
 */
export function getCardRarityFrameAsset(rare) {
  return CARD_RARITY_FRAME_ASSETS[Number(rare)] || CARD_RARITY_FRAME_ASSETS[1]
}

/**
 * 根据卡牌宽度计算标准高度。
 * 未传宽度时回退到 194 x 422 原始比例。
 */
export function getCardFrameHeight(width) {
  const safeWidth = Number(width) || CARD_RENDER_CONFIG.frameWidth
  return Math.round((safeWidth * CARD_RENDER_CONFIG.frameHeight) / CARD_RENDER_CONFIG.frameWidth)
}
