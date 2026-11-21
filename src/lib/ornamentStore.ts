import type { OrnamentMaterial, OrnamentShape, TreePosition } from '../types/ornament.ts'

/**
 * Local ornament records. Photo bytes live in `photo`.
 * Object URLs are created only in memory and are never written here.
 * `order` keeps the on-tree stacking order, because IndexedDB reads back by id.
 */

export const ORNAMENT_DB_NAME = 'wishing-lights'
export const ORNAMENT_STORE_NAME = 'ornaments'

const DB_VERSION = 1

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

export interface StoredOrnament {
  id: string
  photo: Blob
  colors: string[]
  shape: OrnamentShape
  material: OrnamentMaterial
  position: TreePosition | null
  message: string
  soundId: string | null
  order: number
}

export interface LoadedOrnaments {
  ornaments: StoredOrnament[]
  /** Records left in the database because they could not be read safely. */
  skipped: number
}

let databasePromise: Promise<IDBDatabase> | null = null
let epoch = 0
const writeTails = new Map<string, Promise<void>>()

export function parseStoredOrnament(value: unknown): StoredOrnament | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || value.id.length === 0) return null
  if (!(value.photo instanceof Blob) || value.photo.size < 1) return null
  if (!Array.isArray(value.colors) || value.colors.length === 0) return null
  if (!value.colors.every((color) => typeof color === 'string' && HEX_COLOR.test(color))) {
    return null
  }
  if (value.shape !== 'circle') return null
  if (value.material !== 'flat') return null

  const position = parsePosition(value.position)
  if (position === undefined) return null
  if (typeof value.message !== 'string') return null
  if (value.soundId !== null && typeof value.soundId !== 'string') return null

  let order = 0
  if (value.order !== undefined) {
    if (typeof value.order !== 'number' || !Number.isFinite(value.order)) return null
    order = value.order
  }

  return {
    id: value.id,
    photo: value.photo,
    colors: [...value.colors],
    shape: 'circle',
    material: 'flat',
    position,
    message: value.message,
    soundId: value.soundId,
    order,
  }
}

export function loadOrnaments(): Promise<LoadedOrnaments> {
  return enqueue('__load__', async () => {
    const raw = await readAll()
    const ornaments: StoredOrnament[] = []
    let skipped = 0
    for (const value of raw) {
      const parsed = parseStoredOrnament(value)
      if (parsed) ornaments.push(parsed)
      else skipped += 1
    }
    ornaments.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    return { ornaments, skipped }
  })
}

export function saveOrnament(ornament: StoredOrnament): Promise<void> {
  return enqueue(ornament.id, () => writeRecord(ornament))
}

export function deleteOrnament(id: string): Promise<void> {
  return enqueue(id, () => removeRecord(id))
}

/** Closes the database. Tests use this to start from an empty store. */
export async function resetOrnamentStore(): Promise<void> {
  epoch += 1
  writeTails.clear()
  const opening = databasePromise
  databasePromise = null
  if (opening) {
    const database = await opening.catch(() => null)
    database?.close()
  }
  if (typeof indexedDB === 'undefined') return
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(ORNAMENT_DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error('Could not delete the database'))
    request.onblocked = () => resolve()
  })
}

function enqueue<T>(id: string, work: () => Promise<T>): Promise<T> {
  const generation = epoch
  const previous = writeTails.get(id) ?? Promise.resolve()
  const run = previous.then(
    () => (generation === epoch ? work() : Promise.reject(new Error('Store was reset'))),
    () => (generation === epoch ? work() : Promise.reject(new Error('Store was reset'))),
  )
  writeTails.set(
    id,
    run.then(
      () => undefined,
      () => undefined,
    ),
  )
  return run
}

function openDatabase(): Promise<IDBDatabase> {
  if (!databasePromise) {
    databasePromise = createDatabase().catch((error: unknown) => {
      databasePromise = null
      throw error
    })
  }
  return databasePromise
}

function createDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable'))
      return
    }
    const request = indexedDB.open(ORNAMENT_DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(ORNAMENT_STORE_NAME)) {
        database.createObjectStore(ORNAMENT_STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onerror = () => reject(request.error ?? new Error('IndexedDB failed to open'))
    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => {
        database.close()
        databasePromise = null
      }
      database.onclose = () => {
        databasePromise = null
      }
      resolve(database)
    }
  })
}

async function readAll(): Promise<unknown[]> {
  const database = await openDatabase()
  const records = await runTransaction(database, 'readonly', (store) => store.getAll())
  if (!Array.isArray(records)) throw new Error('Saved ornaments could not be read')
  return records
}

function writeRecord(ornament: StoredOrnament): Promise<void> {
  return openDatabase().then((database) =>
    runTransaction(database, 'readwrite', (store) => {
      store.put(ornament)
    }),
  )
}

function removeRecord(id: string): Promise<void> {
  return openDatabase().then((database) =>
    runTransaction(database, 'readwrite', (store) => {
      store.delete(id)
    }),
  )
}

function runTransaction<T>(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(ORNAMENT_STORE_NAME, mode)
    let request: IDBRequest<T> | void
    try {
      request = action(transaction.objectStore(ORNAMENT_STORE_NAME))
    } catch (error) {
      reject(error)
      return
    }

    let settled = false
    const finish = (value: T | undefined) => {
      if (settled) return
      settled = true
      resolve(value)
    }
    const fail = () => {
      if (settled) return
      settled = true
      reject(transaction.error ?? new Error('IndexedDB request failed'))
    }

    // Reads can resolve as soon as the request succeeds. Writes wait until
    // the transaction commits so a following read sees the new record.
    if (request && mode === 'readonly') {
      const reading = request
      reading.onsuccess = () => finish(reading.result)
    }
    transaction.oncomplete = () => finish(request ? request.result : undefined)
    transaction.onabort = fail
    transaction.onerror = fail
  })
}

function parsePosition(value: unknown): TreePosition | null | undefined {
  if (value === null) return null
  if (!isRecord(value)) return undefined
  if (typeof value.x !== 'number' || typeof value.y !== 'number') return undefined
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) return undefined
  return { x: value.x, y: value.y }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
