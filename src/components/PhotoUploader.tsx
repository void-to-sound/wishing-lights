import { useRef, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { extractColors } from '../lib/colorExtraction.ts'
import { PhotoReadError, preparePhoto } from '../lib/preparePhoto.ts'
import type { DecodedPhoto } from '../lib/preparePhoto.ts'
import type { PreparedPhoto } from '../types/ornament.ts'

const FORMAT_MESSAGE = 'Choose a JPEG, PNG, HEIC, or HEIF photo.'
const DECODE_MESSAGE = "This photo couldn't be read. Try a different JPEG or PNG."
const CONVERSION_MESSAGE =
  "This HEIC photo couldn't be converted. Try a JPEG or PNG."

const ACCEPT = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
  '.jpg',
  '.jpeg',
  '.png',
  '.heic',
  '.heif',
].join(',')

interface PhotoUploaderProps {
  previewUrl: string | null
  colors: string[]
  ornament?: ReactNode
  disabled?: boolean
  onPhotoReady: (photo: PreparedPhoto) => void
}

/**
 * Opens the device photo picker, previews the photograph, and shows the
 * extracted palette. Hands a local object URL and colors back to the parent.
 */
export function PhotoUploader({
  previewUrl,
  colors,
  ornament,
  disabled = false,
  onPhotoReady,
}: PhotoUploaderProps) {
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const requestId = useRef(0)

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const request = ++requestId.current
    setError(null)
    setStatus('Reading photo…')

    let decoded: DecodedPhoto
    try {
      decoded = await preparePhoto(file)
    } catch (caught) {
      if (request !== requestId.current) return
      setStatus(null)
      setError(messageFor(caught))
      return
    }

    try {
      const extracted = extractColors(decoded.bitmap)
      if (request !== requestId.current) return
      setStatus(null)
      setError(null)
      onPhotoReady({
        photoUrl: URL.createObjectURL(decoded.displayBlob),
        photo: decoded.displayBlob,
        colors: extracted,
      })
    } catch {
      if (request !== requestId.current) return
      setStatus(null)
      setError(DECODE_MESSAGE)
    } finally {
      decoded.bitmap.close()
    }
  }

  return (
    <div className="uploader">
      {status ? <p className="hint">{status}</p> : null}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      {previewUrl ? (
        <div className="preview-block">
          <div className="preview-row">
            <img
              className="preview"
              src={previewUrl}
              alt="Selected photograph"
            />
            <ul className="palette" aria-label="Five colors from this photograph">
              {colors.map((color, index) => (
                <li key={`${color}-${index}`}>
                  <span
                    className="swatch"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                  <span className="visually-hidden">{color}</span>
                </li>
              ))}
            </ul>
            {ornament ? (
              <div className="composer-ornament">{ornament}</div>
            ) : null}
          </div>
          <p className="hint">Tap the tree to hang this ornament.</p>
        </div>
      ) : null}

      <label className="button" aria-disabled={disabled || undefined}>
        Add Photo
        <input
          className="visually-hidden"
          type="file"
          accept={ACCEPT}
          disabled={disabled}
          onChange={handleChange}
        />
      </label>
    </div>
  )
}

function messageFor(error: unknown): string {
  if (error instanceof PhotoReadError && error.reason === 'format') return FORMAT_MESSAGE
  if (error instanceof PhotoReadError && error.reason === 'conversion') {
    return CONVERSION_MESSAGE
  }
  return DECODE_MESSAGE
}
