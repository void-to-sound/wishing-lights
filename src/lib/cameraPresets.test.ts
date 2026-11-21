import { describe, expect, it } from 'vitest'
import { JEWELRY_BOX, cinematicEase, frameFocus } from './cameraPresets.ts'
import { TREE_ANCHOR } from './roomCamera.ts'

function visible(camera: { width: number; height: number; x: number; y: number }, vw: number, vh: number) {
  return {
    x0: -camera.x / camera.width,
    x1: (vw - camera.x) / camera.width,
    y0: -camera.y / camera.height,
    y1: (vh - camera.y) / camera.height,
  }
}

describe('frameFocus', () => {
  it('keeps a desktop close-up inside the photograph and nearer than a wider frame', () => {
    const wider = frameFocus(1600, 900, JEWELRY_BOX.x, JEWELRY_BOX.y, 0.5)
    const close = frameFocus(1600, 900, JEWELRY_BOX.x, JEWELRY_BOX.y, 0.32)
    for (const camera of [wider, close]) {
      const view = visible(camera, 1600, 900)
      expect(view.x0).toBeGreaterThanOrEqual(-0.001)
      expect(view.y0).toBeGreaterThanOrEqual(-0.001)
      expect(view.x1).toBeLessThanOrEqual(1.001)
      expect(view.y1).toBeLessThanOrEqual(1.001)
    }
    expect(close.width).toBeGreaterThan(wider.width)
  })

  it('keeps a portrait shot inside the photograph and on the jewelry box', () => {
    const camera = frameFocus(390, 844, JEWELRY_BOX.x, JEWELRY_BOX.y, 0.34)
    const view = visible(camera, 390, 844)
    expect(view.x0).toBeGreaterThanOrEqual(-0.001)
    expect(view.y0).toBeGreaterThanOrEqual(-0.001)
    expect(view.x1).toBeLessThanOrEqual(1.001)
    expect(view.y1).toBeLessThanOrEqual(1.001)
    expect(view.x0).toBeLessThanOrEqual(JEWELRY_BOX.x)
    expect(view.x1).toBeGreaterThanOrEqual(JEWELRY_BOX.x)
  })

  it('places the jewelry box beside the trunk', () => {
    const trunk = TREE_ANCHOR.x + TREE_ANCHOR.width / 2
    expect(JEWELRY_BOX.x).toBeGreaterThan(trunk)
    expect(JEWELRY_BOX.x).toBeLessThan(TREE_ANCHOR.x + TREE_ANCHOR.width + 0.05)
    expect(JEWELRY_BOX.y).toBeLessThan(1)
    expect(JEWELRY_BOX.y).toBeGreaterThan(1 - TREE_ANCHOR.bottom - 0.05)
  })
})

describe('cinematicEase', () => {
  it('starts and ends at rest without overshooting', () => {
    expect(cinematicEase(0)).toBe(0)
    expect(cinematicEase(1)).toBe(1)
    expect(cinematicEase(0.5)).toBeCloseTo(0.5, 5)
    expect(cinematicEase(-1)).toBe(0)
    expect(cinematicEase(2)).toBe(1)
    expect(cinematicEase(0.2)).toBeLessThan(0.2)
    expect(cinematicEase(0.8)).toBeGreaterThan(0.8)
  })
})
