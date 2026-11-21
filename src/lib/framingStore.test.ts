import { describe, expect, it } from 'vitest'
import { compositionFromCamera, createDefaultSequence } from './cameraSequence.ts'
import {
  FRAMING_STORAGE_KEY,
  applyFraming,
  parseFraming,
  readFraming,
  writeFraming,
} from './framingStore.ts'
import { frameRoom } from './roomCamera.ts'

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear() {
      values.clear()
    },
    getItem(key: string) {
      return values.get(key) ?? null
    },
    key(index: number) {
      return [...values.keys()][index] ?? null
    },
    removeItem(key: string) {
      values.delete(key)
    },
    setItem(key: string, value: string) {
      values.set(key, value)
    },
  }
}

describe('framing storage', () => {
  it('saves and restores start and end without touching another key', () => {
    const storage = memoryStorage()
    storage.setItem('wishing-lights', 'ornaments')
    const home = compositionFromCamera(frameRoom(1600, 900), 1600, 900)
    const sequence = createDefaultSequence(home)
    const wide = sequence.shots[0]
    expect(wide).toBeDefined()
    if (!wide) return
    const edited = applyFraming(sequence, {
      version: 1,
      shots: [
        {
          id: 'wide',
          duration: 3200,
          startHome: false,
          start: { focusX: 0.4, focusY: 0.45, viewWidth: 0.7 },
          end: { focusX: 0.35, focusY: 0.5, viewWidth: 0.62 },
        },
      ],
    })
    writeFraming(edited, storage)
    const restored = applyFraming(createDefaultSequence(home), readFraming(storage) ?? { version: 1, shots: [] })
    expect(storage.getItem('wishing-lights')).toBe('ornaments')
    expect(storage.getItem(FRAMING_STORAGE_KEY)).toBeTruthy()
    expect(restored.shots[0]?.take.duration).toBe(3200)
    expect(restored.shots[0]?.take.samples[0]).toMatchObject({
      home: false,
      composition: { focusX: 0.4, focusY: 0.45, viewWidth: 0.7 },
    })
    expect(restored.shots[0]?.take.samples[1]?.composition.viewWidth).toBe(0.62)
    expect(restored.shots[1]?.take.samples[0]?.composition).toEqual(
      sequence.shots[1]?.take.samples[0]?.composition,
    )
  })

  it('ignores a corrupt record', () => {
    expect(parseFraming({ version: 1, shots: [{ id: 'wide' }] })).toBeNull()
    expect(parseFraming(null)).toBeNull()
  })
})
