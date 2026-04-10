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
  riteTitlePlate: 'rite_title_bg',
  riteTitleLine: 'rite_title_short',
  slotFrame: 'nomal_slot_bg',
  dialogueFrame: '1-3',
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
    image: 'gold',
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
export function getCardRarityFrameAsset(rare) {
  return CARD_RARITY_FRAME_ASSETS[Number(rare)] || CARD_RARITY_FRAME_ASSETS[1]
}

/**
 * 根据稀有度读取卡牌底板资源。
 * 未知稀有度时回退到最低档，保证界面始终有卡牌背景可显示。
 */
export function getCardRarityFrameAsset(rare) {
  return CARD_RARITY_FRAME_ASSETS[Number(rare)] || CARD_RARITY_FRAME_ASSETS[1]
}
