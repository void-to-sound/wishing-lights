import { useEffect, useRef, useState } from 'react'
import { ChristmasTree } from './components/ChristmasTree.tsx'
import { MemoryViewer } from './components/MemoryViewer.tsx'
import { Ornament } from './components/Ornament.tsx'
import { PhotoUploader } from './components/PhotoUploader.tsx'
import {
  deleteOrnament,
  loadOrnaments,
  saveOrnament,
  type StoredOrnament,
} from './lib/ornamentStore.ts'
import type { Ornament as OrnamentModel, PreparedPhoto, TreePosition } from './types/ornament.ts'

const SAVE_ERROR =
  'This change could not be saved on this device. A refresh may not keep it.'
const LOAD_ERROR =
  'Saved ornaments could not be opened. You can still decorate this tree, but a refresh may not keep them.'
const SKIP_NOTICE =
  'Some saved ornaments could not be read. The rest of the tree was restored.'

/** Works on phone browsers opened over http:// on the local network. */
function createId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function storedFrom(ornament: OrnamentModel, photo: Blob, order: number): StoredOrnament {
  return {
    id: ornament.id,
    photo,
    colors: ornament.colors,
    shape: ornament.shape,
    material: ornament.material,
    position: ornament.position,
    message: ornament.message,
    soundId: ornament.soundId,
    order,
  }
}

function App() {
  const [ornaments, setOrnaments] = useState<OrnamentModel[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [storageError, setStorageError] = useState<string | null>(null)
  const ornamentsRef = useRef(ornaments)
  const photosRef = useRef(new Map<string, Blob>())
  const orderRef = useRef(new Map<string, number>())
  const nextOrderRef = useRef(0)
  const hydratedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    const created: string[] = []

    loadOrnaments()
      .then((loaded) => {
        if (cancelled) return
        const restored: OrnamentModel[] = []
        let maxOrder = 0
        for (const record of loaded.ornaments) {
          const photoUrl = URL.createObjectURL(record.photo)
          created.push(photoUrl)
          photosRef.current.set(record.id, record.photo)
          orderRef.current.set(record.id, record.order)
          if (record.order > maxOrder) maxOrder = record.order
          restored.push({
            id: record.id,
            photoUrl,
            colors: record.colors,
            shape: record.shape,
            material: record.material,
            position: record.position,
            message: record.message,
            soundId: record.soundId,
          })
        }
        if (cancelled) {
          for (const url of created) URL.revokeObjectURL(url)
          photosRef.current.clear()
          orderRef.current.clear()
          return
        }
        nextOrderRef.current = maxOrder
        ornamentsRef.current = restored
        hydratedRef.current = true
        setOrnaments(restored)
        if (loaded.skipped > 0) setStorageError(SKIP_NOTICE)
        setReady(true)
      })
      .catch(() => {
        if (cancelled) return
        hydratedRef.current = true
        setStorageError(LOAD_ERROR)
        setReady(true)
      })

    return () => {
      cancelled = true
      for (const url of created) URL.revokeObjectURL(url)
    }
  }, [])

  useEffect(() => {
    return () => {
      for (const ornament of ornamentsRef.current) URL.revokeObjectURL(ornament.photoUrl)
    }
  }, [])

  function reportFailure() {
    setStorageError(SAVE_ERROR)
  }

  function orderFor(id: string): number {
    const existing = orderRef.current.get(id)
    if (existing !== undefined) return existing
    nextOrderRef.current += 1
    orderRef.current.set(id, nextOrderRef.current)
    return nextOrderRef.current
  }

  function persist(ornament: OrnamentModel) {
    const photo = photosRef.current.get(ornament.id)
    const order = orderRef.current.get(ornament.id)
    if (!photo || order === undefined) {
      reportFailure()
      return
    }
    void saveOrnament(storedFrom(ornament, photo, order)).catch(reportFailure)
  }

  function handlePhotoReady(photo: PreparedPhoto) {
    if (!hydratedRef.current) {
      URL.revokeObjectURL(photo.photoUrl)
      return
    }

    const removed = ornamentsRef.current.filter((ornament) => ornament.position === null)
    for (const ornament of removed) {
      URL.revokeObjectURL(ornament.photoUrl)
      photosRef.current.delete(ornament.id)
      orderRef.current.delete(ornament.id)
      void deleteOrnament(ornament.id).catch(reportFailure)
    }

    const created: OrnamentModel = {
      id: createId(),
      photoUrl: photo.photoUrl,
      colors: photo.colors,
      shape: 'circle',
      material: 'flat',
      position: null,
      message: '',
      soundId: null,
    }
    photosRef.current.set(created.id, photo.photo)
    orderFor(created.id)
    ornamentsRef.current = [
      ...ornamentsRef.current.filter((ornament) => ornament.position !== null),
      created,
    ]
    setOrnaments(ornamentsRef.current)
    persist(created)
  }

  function handlePlace(position: TreePosition) {
    const pending = ornamentsRef.current.find((ornament) => ornament.position === null)
    if (!pending) return
    const placed = { ...pending, position }
    ornamentsRef.current = ornamentsRef.current.map((ornament) =>
      ornament.id === pending.id ? placed : ornament,
    )
    setOrnaments(ornamentsRef.current)
    persist(placed)
  }

  function handleMessageChange(message: string) {
    if (!selectedId) return
    const existing = ornamentsRef.current.find((ornament) => ornament.id === selectedId)
    if (!existing) return
    const updated = { ...existing, message }
    ornamentsRef.current = ornamentsRef.current.map((ornament) =>
      ornament.id === selectedId ? updated : ornament,
    )
    setOrnaments(ornamentsRef.current)
    persist(updated)
  }

  const pending = ornaments.find((ornament) => ornament.position === null) ?? null
  const placed = ornaments.filter(
    (ornament): ornament is OrnamentModel & { position: TreePosition } =>
      ornament.position !== null,
  )
  const selected =
    ornaments.find((ornament) => ornament.id === selectedId && ornament.position) ?? null

  return (
    <div className="app">
      <header className="header">
        <h1>Wishing Lights</h1>
        <p>Turn a photograph into an ornament and hang it on the tree.</p>
      </header>

      {storageError ? (
        <p className="error idle-hint" role="alert">
          {storageError}
        </p>
      ) : null}

      {!ready ? (
        <p className="hint idle-hint">Restoring your tree…</p>
      ) : !pending ? (
        <p className="hint idle-hint">
          {placed.length === 0
            ? 'Add a photo to make your first ornament.'
            : 'Add another photo, then tap the tree to hang it.'}
        </p>
      ) : null}

      <ChristmasTree
        ornaments={placed}
        placing={pending !== null}
        onPlace={handlePlace}
        onSelect={setSelectedId}
      />

      <footer className="dock">
        <PhotoUploader
          previewUrl={pending?.photoUrl ?? null}
          colors={pending?.colors ?? []}
          disabled={!ready}
          ornament={
            pending ? (
              <Ornament
                id={`preview-${pending.id}`}
                colors={pending.colors}
                label="New ornament"
              />
            ) : null
          }
          onPhotoReady={handlePhotoReady}
        />
      </footer>

      {selected ? (
        <MemoryViewer
          ornament={selected}
          onMessageChange={handleMessageChange}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  )
}

export default App
