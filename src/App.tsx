import { useRef, useState } from 'react'
import { ChristmasTree } from './components/ChristmasTree.tsx'
import { MemoryViewer } from './components/MemoryViewer.tsx'
import { Ornament } from './components/Ornament.tsx'
import { PhotoUploader } from './components/PhotoUploader.tsx'
import type { Ornament as OrnamentModel, PreparedPhoto, TreePosition } from './types/ornament.ts'

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

function App() {
  const [ornaments, setOrnaments] = useState<OrnamentModel[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const pendingPhotoUrl = useRef<string | null>(null)

  const pending = ornaments.find((ornament) => ornament.position === null) ?? null
  const placed = ornaments.filter(
    (ornament): ornament is OrnamentModel & { position: TreePosition } =>
      ornament.position !== null,
  )
  const selected =
    ornaments.find((ornament) => ornament.id === selectedId && ornament.position) ??
    null

  function handlePhotoReady(photo: PreparedPhoto) {
    const previousUrl = pendingPhotoUrl.current
    pendingPhotoUrl.current = photo.photoUrl
    if (previousUrl) URL.revokeObjectURL(previousUrl)

    setOrnaments((current) => [
      ...current.filter((ornament) => ornament.position !== null),
      {
        id: createId(),
        photoUrl: photo.photoUrl,
        colors: photo.colors,
        shape: 'circle',
        material: 'flat',
        position: null,
        message: '',
        soundId: null,
      },
    ])
  }

  function handlePlace(position: TreePosition) {
    pendingPhotoUrl.current = null
    setOrnaments((current) =>
      current.map((ornament) =>
        ornament.position === null ? { ...ornament, position } : ornament,
      ),
    )
  }

  function handleMessageChange(message: string) {
    if (!selectedId) return
    setOrnaments((current) =>
      current.map((ornament) =>
        ornament.id === selectedId ? { ...ornament, message } : ornament,
      ),
    )
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Wishing Lights</h1>
        <p>Turn a photograph into an ornament and hang it on the tree.</p>
      </header>

      {!pending ? (
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
