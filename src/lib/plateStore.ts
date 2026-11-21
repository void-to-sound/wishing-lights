/**
 * The close-up plate for the camera experiment.
 * Bytes stay in this database and are never sent to a server.
 * Ornament records live in a different database.
 */

export const CAMERA_DB_NAME = 'wishing-lights-camera'
export const PLATE_STORE_NAME = 'plates'
const PLATE_KEY = 'jewelry-box'
const DB_VERSION = 1

export interface StoredPlate {
  blob: Blob
  width: number
  height: number
  name: string
}

let databasePromise: Promise<IDBDatabase> | null = null

export function loadPlate(): Promise<StoredPlate | null> {
  return openDatabase().then((database) =>
    run<unknown>(database, 'readonly', (store) => store.get(PLATE_KEY)),
  ).then((value) => parsePlate(value))
}

export function savePlate(plate: StoredPlate): Promise<void> {
  return openDatabase().then((database) =>
    run(database, 'readwrite', (store) =>
      store.put({ key: PLATE_KEY, ...plate }),
    ),
  ).then(() => undefined)
}

export function deletePlate(): Promise<void> {
  return openDatabase().then((database) =>
    run(database, 'readwrite', (store) => store.delete(PLATE_KEY)),
  ).then(() => undefined)
}

export async function resetPlateStore(): Promise<void> {
  const opening = databasePromise
  databasePromise = null
  if (opening) {
    const database = await opening.catch(() => null)
    database?.close()
  }
  if (typeof indexedDB === 'undefined') return
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(CAMERA_DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error('Could not delete the camera database'))
    request.onblocked = () => resolve()
  })
}

export function readImageFile(file: File): Promise<StoredPlate> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      const width = image.naturalWidth
      const height = image.naturalHeight
      URL.revokeObjectURL(url)
      if (width < 1 || height < 1) {
        reject(new Error('That image has no pixels.'))
        return
      }
      resolve({ blob: file, width, height, name: file.name || 'close-up' })
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('That image could not be read.'))
    }
    image.src = url
  })
}

function parsePlate(value: unknown): StoredPlate | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Partial<StoredPlate>
  if (!(record.blob instanceof Blob) || record.blob.size < 1) return null
  if (typeof record.width !== 'number' || typeof record.height !== 'number') return null
  if (record.width < 1 || record.height < 1) return null
  return {
    blob: record.blob,
    width: record.width,
    height: record.height,
    name: typeof record.name === 'string' && record.name.length > 0 ? record.name : 'close-up',
  }
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
    const request = indexedDB.open(CAMERA_DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(PLATE_STORE_NAME)) {
        database.createObjectStore(PLATE_STORE_NAME, { keyPath: 'key' })
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

function run<T>(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(PLATE_STORE_NAME, mode)
    const request = work(transaction.objectStore(PLATE_STORE_NAME))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('The close-up image could not be stored'))
  })
}
