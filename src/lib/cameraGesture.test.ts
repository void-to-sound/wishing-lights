import { describe, expect, it } from 'vitest'
import { frameFocus } from './cameraPresets.ts'
import { framingLimitMessage, panByPixels, pinchZoomFactor, wheelZoomFactor, zoomAtPoint } from './cameraGesture.ts'

function pointUnder(camera: { width: number; height: number; x: number; y: number }, x: number, y: number) {
  return {
    x: (x - camera.x) / camera.width,
    y: (y - camera.y) / camera.height,
  }
}

describe('panByPixels', () => {
  it('moves the picture with the pointer', () => {
    const start = { focusX: 0.5, focusY: 0.5, viewWidth: 0.6 }
    const next = panByPixels(start, 80, -40, 800, 600, 2)
    expect(next.focusX).toBeLessThan(start.focusX)
    expect(next.focusY).toBeGreaterThan(start.focusY)
    const before = frameFocus(800, 600, start.focusX, start.focusY, start.viewWidth, 2)
    const after = frameFocus(800, 600, next.focusX, next.focusY, next.viewWidth, 2)
    expect(after.x).toBeGreaterThan(before.x)
    expect(after.y).toBeLessThan(before.y)
  })

  it('stops at the edge of the artwork', () => {
    const start = { focusX: 0.5, focusY: 0.5, viewWidth: 0.6 }
    const next = panByPixels(start, 5000, 5000, 800, 600, 2)
    const camera = frameFocus(800, 600, next.focusX, next.focusY, next.viewWidth, 2)
    expect(-camera.x / camera.width).toBeGreaterThanOrEqual(-0.001)
    expect(-camera.y / camera.height).toBeGreaterThanOrEqual(-0.001)
    expect((800 - camera.x) / camera.width).toBeLessThanOrEqual(1.001)
    expect((600 - camera.y) / camera.height).toBeLessThanOrEqual(1.001)
  })
})

describe('zoomAtPoint', () => {
  it('keeps the artwork point under the cursor', () => {
    const start = { focusX: 0.5, focusY: 0.5, viewWidth: 0.6 }
    const cursor = { x: 220, y: 180 }
    const next = zoomAtPoint(start, 0.7, cursor.x, cursor.y, 800, 600, 2)
    expect(next.viewWidth).toBeCloseTo(0.42, 5)
    const before = frameFocus(800, 600, start.focusX, start.focusY, start.viewWidth, 2)
    const after = frameFocus(800, 600, next.focusX, next.focusY, next.viewWidth, 2)
    expect(pointUnder(after, cursor.x, cursor.y)).toEqual({
      x: expect.closeTo(pointUnder(before, cursor.x, cursor.y).x, 5),
      y: expect.closeTo(pointUnder(before, cursor.x, cursor.y).y, 5),
    })
  })

  it('treats a downward wheel as moving away and a pinch apart as moving closer', () => {
    expect(wheelZoomFactor(100, 0, 800)).toBeGreaterThan(1)
    expect(wheelZoomFactor(-100, 0, 800)).toBeLessThan(1)
    expect(pinchZoomFactor(100, 140)).toBeLessThan(1)
    expect(pinchZoomFactor(140, 100)).toBeGreaterThan(1)
  })
})

describe('framingLimitMessage', () => {
  it('explains when a tall screen cannot show a wide saved frame', () => {
    const message = framingLimitMessage(0.8, 390, 844, 2)
    expect(message).toContain('taller than the picture')
    expect(message).toContain('0.80')
  })

  it('stays quiet when the saved frame fits', () => {
    expect(framingLimitMessage(0.5, 1600, 900, 2)).toBeNull()
  })
})
