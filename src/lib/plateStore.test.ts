import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { ORNAMENT_DB_NAME } from './ornamentStore.ts'
import {
  CAMERA_DB_NAME,
  deletePlate,
  loadPlate,
  resetPlateStore,
  savePlate,
} from './plateStore.ts'

beforeEach(async () => {
  await resetPlateStore()
})

describe('plate store', () => {
  it('saves, replaces, and removes a close-up in its own database', async () => {
    expect(await loadPlate()).toBeNull()
    await savePlate({
      blob: new Blob(['plate-a'], { type: 'image/png' }),
      width: 800,
      height: 1200,
      name: 'box.png',
    })
    const first = await loadPlate()
    expect(first?.width).toBe(800)
    expect(first?.height).toBe(1200)
    expect(first?.name).toBe('box.png')
    expect(await first?.blob.text()).toBe('plate-a')

    await savePlate({
      blob: new Blob(['plate-b'], { type: 'image/jpeg' }),
      width: 1000,
      height: 1000,
      name: 'replacement.jpg',
    })
    const second = await loadPlate()
    expect(second?.name).toBe('replacement.jpg')
    expect(await second?.blob.text()).toBe('plate-b')

    await deletePlate()
    expect(await loadPlate()).toBeNull()
    expect(CAMERA_DB_NAME).not.toBe(ORNAMENT_DB_NAME)
  })
})
