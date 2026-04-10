/**
 * 计算当前画布真正可见的矩形区域。
 * 右侧详情栏是固定浮层时，节点应该落在未被遮挡的左侧可见区中央。
 */
export function getVisibleCanvasRect(canvasRect, overlayRect = null) {
  if (!canvasRect) return null

  const rightEdge = overlayRect
    ? Math.min(canvasRect.right, overlayRect.left)
    : canvasRect.right

  return {
    left: canvasRect.left,
    top: canvasRect.top,
    right: Math.max(canvasRect.left, rightEdge),
    bottom: canvasRect.bottom,
    width: Math.max(0, rightEdge - canvasRect.left),
    height: Math.max(0, canvasRect.bottom - canvasRect.top),
  }
}

/**
 * 按当前缩放级别，为目标节点生成一个“落在可见区域中央”的视口。
 */
export function buildFocusViewport({
  canvasRect,
  overlayRect = null,
  nodePosition,
  nodeSize,
  zoom,
}) {
  const visibleRect = getVisibleCanvasRect(canvasRect, overlayRect)
  if (!visibleRect) return null

  const focusX = nodePosition.x + nodeSize.width / 2
  const focusY = nodePosition.y + nodeSize.height / 2
  const targetScreenX = (visibleRect.left + visibleRect.right) / 2 - canvasRect.left
  const targetScreenY = (visibleRect.top + visibleRect.bottom) / 2 - canvasRect.top

  return {
    x: targetScreenX - focusX * zoom,
    y: targetScreenY - focusY * zoom,
    zoom,
  }
}
