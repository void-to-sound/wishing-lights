import type { Ornament } from '../types/ornament.ts'

interface MemoryViewerProps {
  ornament: Ornament
  onMessageChange: (message: string) => void
  onClose: () => void
}

/**
 * Shows the photograph behind one ornament and edits its short memory.
 * Closing returns to the tree without discarding the message.
 */
export function MemoryViewer({
  ornament,
  onMessageChange,
  onClose,
}: MemoryViewerProps) {
  return (
    <div className="memory-backdrop" onClick={onClose}>
      <section
        className="memory-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Memory"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="memory-header">
          <h2>Memory</h2>
          <button type="button" className="button memory-close" onClick={onClose}>
            Close
          </button>
        </div>
        <img
          className="memory-photo"
          src={ornament.photoUrl}
          alt="Original photograph for this ornament"
        />
        <label className="memory-label">
          Memory message
          <textarea
            value={ornament.message}
            onChange={(event) => onMessageChange(event.target.value)}
            maxLength={500}
            rows={4}
            placeholder="Write a short memory"
          />
        </label>
      </section>
    </div>
  )
}
