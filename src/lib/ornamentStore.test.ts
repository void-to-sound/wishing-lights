import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  ORNAMENT_DB_NAME,
  ORNAMENT_STORE_NAME,
  deleteOrnament,
  loadOrnaments,
  parseStoredOrnament,
  resetOrnamentStore,
  saveOrnament,
  type StoredOrnament,
} from './ornamentStore.ts'

function ornament(overrides: Partial<StoredOrnament> = {}): StoredOrnament {
  return {
    id: 'ornament-1',
    photo: new Blob(['photo-bytes'], { type: 'image/jpeg' }),
    colors: ['#112233', '#abcdef', '#010203', '#aabbcc', '#445566'],
    shape: 'circle',
    material: 'flat',
    position: { x: 0.33, y: 0.5 },
    message: 'A memory',
    soundId: null,
    order: 1,
    ...overrides,
  }
}

beforeEach(async () => {
  await resetOrnamentStore()
})

describe('parseStoredOrnament', () => {
  it('accepts a complete record and drops fields that are not stored', () => {
    const photo = new Blob(['pixels'], { type: 'image/png' })
    const parsed = parseStoredOrnament({
      id: 'abc',
      photo,
      photoUrl: 'blob:http://localhost/temporary',
      colors: ['#ffffff'],
      shape: 'circle',
      material: 'flat',
      position: null,
      message: '',
      soundId: 'future-sound',
      order: 4,
    })

    expect(parsed).toEqual({
      id: 'abc',
      photo,
      colors: ['#ffffff'],
      shape: 'circle',
      material: 'flat',
      position: null,
      message: '',
      soundId: 'future-sound',
      order: 4,
    })
    expect(parsed && 'photoUrl' in parsed).toBe(false)
  })

  it('rejects records that have no usable photo', () => {
    expect(parseStoredOrnament({ ...ornament(), photo: 'blob:http://localhost/x' })).toBeNull()
    expect(parseStoredOrnament({ ...ornament(), photo: new Blob([]) })).toBeNull()
    expect(parseStoredOrnament(null)).toBeNull()
    expect(parseStoredOrnament({ ...ornament(), position: { x: Number.NaN, y: 0.2 } })).toBeNull()
    expect(parseStoredOrnament({ ...ornament(), shape: 'crystal' })).toBeNull()
    expect(parseStoredOrnament({ ...ornament(), material: 'velvet' as StoredOrnament['material'] })).toBeNull()
  })
})

describe('ornament store', () => {
  it('round-trips a designed glass ornament and still accepts the original flat ones', async () => {
    await saveOrnament(ornament({ id: 'glass-1', material: 'glass' }))
    await saveOrnament(ornament({ id: 'flat-1', material: 'flat' }))
    const loaded = await loadOrnaments()
    expect(loaded.skipped).toBe(0)
    expect(loaded.ornaments.map((item) => item.material).sort()).toEqual(['flat', 'glass'])
  })

  it('round-trips the photo blob, placement, and message', async () => {
    const saved = ornament({
      position: { x: 0.125, y: 0.875 },
      message: '저녁 산책',
      soundId: 'bell',
    })
    await saveOrnament(saved)

    const loaded = await loadOrnaments()
    expect(loaded.skipped).toBe(0)
    expect(loaded.ornaments).toHaveLength(1)
    const [restored] = loaded.ornaments
    expect(restored.id).toBe(saved.id)
    expect(restored.position).toEqual({ x: 0.125, y: 0.875 })
    expect(restored.message).toBe('저녁 산책')
    expect(restored.soundId).toBe('bell')
    expect(restored.colors).toEqual(saved.colors)
    expect(restored.photo).toBeInstanceOf(Blob)
    expect(await restored.photo.text()).toBe('photo-bytes')
    expect(restored.photo.type).toBe('image/jpeg')
  })

  it('keeps an unplaced ornament and restores it with a null position', async () => {
    await saveOrnament(ornament({ position: null, order: 2 }))
    const loaded = await loadOrnaments()
    expect(loaded.ornaments[0].position).toBeNull()
  })

  it('applies rapid updates to the same ornament in order', async () => {
    const first = ornament({ message: '1' })
    const writes = [
      saveOrnament(first),
      saveOrnament({ ...first, message: '12' }),
      saveOrnament({ ...first, message: '123', position: { x: 0.4, y: 0.6 } }),
    ]
    await Promise.all(writes)

    const loaded = await loadOrnaments()
    expect(loaded.ornaments[0].message).toBe('123')
    expect(loaded.ornaments[0].position).toEqual({ x: 0.4, y: 0.6 })
  })

  it('does not let an older save recreate an ornament that was replaced', async () => {
    const waiting = ornament({ id: 'waiting', position: null, order: 1 })
    const replacement = ornament({
      id: 'replacement',
      position: null,
      order: 2,
      photo: new Blob(['second'], { type: 'image/jpeg' }),
    })

    await Promise.all([
      saveOrnament(waiting),
      deleteOrnament(waiting.id),
      saveOrnament(replacement),
    ])

    const loaded = await loadOrnaments()
    expect(loaded.ornaments.map((item) => item.id)).toEqual(['replacement'])
    expect(await loaded.ornaments[0].photo.text()).toBe('second')
  })

  it('leaves a corrupt record in place and still restores the valid ones', async () => {
    const first = ornament({ id: 'b', order: 2, message: 'second' })
    const second = ornament({ id: 'a', order: 1, message: 'first' })
    await saveOrnament(first)
    await saveOrnament(second)
    await putRaw({
      id: 'corrupt',
      photoUrl: 'blob:http://localhost/gone',
      colors: ['#ffffff'],
      shape: 'circle',
      material: 'flat',
      position: null,
      message: 'keep me',
      soundId: null,
    })

    const loaded = await loadOrnaments()
    expect(loaded.skipped).toBe(1)
    expect(loaded.ornaments.map((item) => item.message)).toEqual(['first', 'second'])

    const raw = await readRaw()
    expect(raw.map((item) => item.id).sort()).toEqual(['a', 'b', 'corrupt'])
  })

  it('removes only the ornament that was deleted', async () => {
    await saveOrnament(ornament({ id: 'keep', order: 1 }))
    await saveOrnament(ornament({ id: 'drop', order: 2 }))
    await deleteOrnament('drop')

    const loaded = await loadOrnaments()
    expect(loaded.ornaments.map((item) => item.id)).toEqual(['keep'])
  })
})

function openRaw(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(ORNAMENT_DB_NAME)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open the database'))
  })
}

async function putRaw(value: unknown): Promise<void> {
  const database = await openRaw()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(ORNAMENT_STORE_NAME, 'readwrite')
    transaction.objectStore(ORNAMENT_STORE_NAME).put(value)
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error ?? new Error('Could not write'))
  })
  database.close()
}

async function readRaw(): Promise<Array<{ id: string }>> {
  const database = await openRaw()
  const records = await new Promise<Array<{ id: string }>>((resolve, reject) => {
    const transaction = database.transaction(ORNAMENT_STORE_NAME, 'readonly')
    const request = transaction.objectStore(ORNAMENT_STORE_NAME).getAll()
    request.onsuccess = () => resolve(request.result as Array<{ id: string }>)
    request.onerror = () => reject(request.error ?? new Error('Could not read'))
  })
  database.close()
  return records
}
