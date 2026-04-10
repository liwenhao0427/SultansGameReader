import { describe, expect, it } from 'vitest'
import { buildFocusViewport, getVisibleCanvasRect } from './canvasViewport.js'

describe('canvasViewport', () => {
  it('无浮层时可见区域等于画布区域', () => {
    const canvasRect = { left: 0, top: 0, right: 1200, bottom: 800 }
    expect(getVisibleCanvasRect(canvasRect)).toEqual({
      left: 0,
      top: 0,
      right: 1200,
      bottom: 800,
      width: 1200,
      height: 800,
    })
  })

  it('有右侧详情栏时只保留未遮挡区域', () => {
    const canvasRect = { left: 100, top: 40, right: 1500, bottom: 940 }
    const overlayRect = { left: 980, top: 10, right: 1480, bottom: 930 }
    expect(getVisibleCanvasRect(canvasRect, overlayRect)).toEqual({
      left: 100,
      top: 40,
      right: 980,
      bottom: 940,
      width: 880,
      height: 900,
    })
  })

  it('会把节点中心对准可见区域中央而不是整张画布中央', () => {
    const viewport = buildFocusViewport({
      canvasRect: { left: 0, top: 0, right: 1400, bottom: 900 },
      overlayRect: { left: 900, top: 18, right: 1420, bottom: 880 },
      nodePosition: { x: 1000, y: 200 },
      nodeSize: { width: 200, height: 120 },
      zoom: 1,
    })

    expect(viewport).toEqual({
      x: -650,
      y: 190,
      zoom: 1,
    })
  })
})
