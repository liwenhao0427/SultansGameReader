// 导出所有自定义节点组件及 nodeTypes 映射
import EventNode from './EventNode'
import RiteNode from './RiteNode'
import LootNode from './LootNode'
import AfterStoryNode from './AfterStoryNode'
import CardNode from './CardNode'
import GenericNode from './GenericNode'

export { EventNode, RiteNode, LootNode, AfterStoryNode, CardNode, GenericNode }

// nodeTypes 映射，传入 <ReactFlow nodeTypes={nodeTypes} />
export const nodeTypes = {
  event: EventNode,
  rite: RiteNode,
  loot: LootNode,
  after_story: AfterStoryNode,
  card: CardNode,
  over: GenericNode,
  upgrade: GenericNode,
  dt: GenericNode,
}
