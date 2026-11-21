import { describe, expect, it } from 'vitest'
import {
  PREFERRED_FRAME,
  TREE_FOCUS_X,
  clampLook,
  frameRoom,
} from './roomCamera.ts'

function visible(camera: { width: number; height: number; x: number; y: number }, vw: number, vh: number) {
  return {
    x0: -camera.x / camera.width,
    x1: (vw - camera.x) / camera.width,
    y0: -camera.y / camera.height,
    y1: (vh - camera.y) / camera.height,
  }
}

describe('frameRoom', () => {
  it('fills a 16:9 laptop with the preferred composition', () => {
    const camera = frameRoom(1600, 900)
    const view = visible(camera, 1600, 900)
    expect(view.x0).toBeLessThanOrEqual(PREFERRED_FRAME.x + 0.01)
    expect(view.x1).toBeGreaterThanOrEqual(PREFERRED_FRAME.x + PREFERRED_FRAME.width - 0.01)
    expect(view.y0).toBeLessThanOrEqual(PREFERRED_FRAME.y + 0.01)
    expect(view.y1).toBeGreaterThanOrEqual(PREFERRED_FRAME.y + PREFERRED_FRAME.height - 0.01)
    expect(camera.explore).toBe(false)
  })

  it('reveals more of an ultrawide room without cropping the preferred frame', () => {
    const laptop = frameRoom(1600, 900)
    const wide = frameRoom(2560, 1080)
    const view = visible(wide, 2560, 1080)
    const laptopView = visible(laptop, 1600, 900)
    expect(view.x1 - view.x0).toBeGreaterThan(laptopView.x1 - laptopView.x0)
    expect(view.x0).toBeLessThanOrEqual(PREFERRED_FRAME.x + 0.01)
    expect(view.x1).toBeGreaterThanOrEqual(PREFERRED_FRAME.x + PREFERRED_FRAME.width - 0.01)
    expect(view.y0).toBeLessThanOrEqual(PREFERRED_FRAME.y + 0.01)
    expect(view.y1).toBeGreaterThanOrEqual(PREFERRED_FRAME.y + PREFERRED_FRAME.height - 0.01)
  })

  it('starts a portrait view on the tree and can look toward the fireplace', () => {
    const camera = frameRoom(390, 844, TREE_FOCUS_X)
    expect(camera.explore).toBe(true)
    const center = (390 / 2 - camera.x) / camera.width
    expect(center).toBeCloseTo(TREE_FOCUS_X, 2)
    const view = visible(camera, 390, 844)
    expect(view.y0).toBeCloseTo(PREFERRED_FRAME.y, 2)
    expect(view.y1).toBeCloseTo(PREFERRED_FRAME.y + PREFERRED_FRAME.height, 2)

    const towardFire = frameRoom(390, 844, clampLook(390, camera.width, 0.7))
    expect(towardFire.x).toBeLessThan(camera.x)
    expect(-towardFire.x / towardFire.width).toBeGreaterThanOrEqual(-0.001)
    expect((390 - towardFire.x) / towardFire.width).toBeLessThanOrEqual(1.001)
  })
})
