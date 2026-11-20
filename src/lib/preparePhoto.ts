/**
 * Decodes a picked photograph into pixels the rest of the app can use.
 *
 * The browser is tried first, with EXIF orientation applied. HEIC and HEIF
 * files that the browser cannot decode are converted to an upright JPEG in
 * the browser. Nothing is uploaded.
 */

const JPEG_PNG_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/pjpeg',
])

const HEIC_TYPES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
])

const ACCEPTED_EXTENSION = /\.(jpe?g|png|heic|heif)$/i
const HEIC_EXTENSION = /\.(heic|heif)$/i

/** Major brands used by HEIC and HEIF files. */
const HEIF_BRANDS = new Set([
  'heic',
  'heix',
  'hevc',
  'hevx',
  'heim',
  'heis',
  'hevm',
  'hevs',
  'mif1',
  'msf1',
])

export type PhotoReadFailure = 'format' | 'decode' | 'conversion'

export class PhotoReadError extends Error {
  readonly reason: PhotoReadFailure

  constructor(reason: PhotoReadFailure) {
    super(reason)
    this.name = 'PhotoReadError'
    this.reason = reason
  }
}

export interface DecodedPhoto {
  /**
   * Image to show in the preview and memory panel.
   * This is a converted JPEG when the original HEIC could not be decoded.
   */
  displayBlob: Blob
  /** Oriented pixels for color extraction. The caller closes this bitmap. */
  bitmap: ImageBitmap
}

export async function preparePhoto(file: File): Promise<DecodedPhoto> {
  if (!isAllowedPhoto(file)) throw new PhotoReadError('format')

  const native = await tryDecode(file)
  if (native) return { displayBlob: file, bitmap: native }

  if (!(isHeicFile(file) || (await sniffHeif(file)))) {
    throw new PhotoReadError('decode')
  }

  const jpeg = await convertHeicToJpeg(file)
  const converted = await tryDecode(jpeg)
  if (!converted) throw new PhotoReadError('conversion')
  return { displayBlob: jpeg, bitmap: converted }
}

function isAllowedPhoto(file: File): boolean {
  const type = file.type.toLowerCase()
  if (JPEG_PNG_TYPES.has(type) || HEIC_TYPES.has(type)) return true
  // Phones often omit a MIME type for HEIC and HEIF.
  if (type === '' || type === 'application/octet-stream') {
    return ACCEPTED_EXTENSION.test(file.name)
  }
  return false
}

function isHeicFile(file: File): boolean {
  if (HEIC_TYPES.has(file.type.toLowerCase())) return true
  return HEIC_EXTENSION.test(file.name)
}

async function sniffHeif(file: Blob): Promise<boolean> {
  if (file.size < 12) return false
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  return ascii(bytes, 4, 8) === 'ftyp' && HEIF_BRANDS.has(ascii(bytes, 8, 12))
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  let text = ''
  for (let index = start; index < end; index += 1) text += String.fromCharCode(bytes[index])
  return text
}

/**
 * libheif applies the HEIF rotation while converting, so the JPEG pixels are
 * already upright. Browser-decoded JPEG and PNG files get EXIF orientation
 * from createImageBitmap instead.
 */
async function tryDecode(blob: Blob): Promise<ImageBitmap | null> {
  const bitmap =
    (await createBitmap(blob, { imageOrientation: 'from-image' })) ??
    (await createBitmap(blob))
  if (!bitmap) return null
  if (bitmap.width < 1 || bitmap.height < 1) {
    bitmap.close()
    return null
  }
  return bitmap
}

async function createBitmap(
  blob: Blob,
  options?: ImageBitmapOptions,
): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(blob, options)
  } catch {
    return null
  }
}

async function convertHeicToJpeg(file: Blob): Promise<Blob> {
  try {
    const { heicTo } = await import('heic-to')
    const jpeg = await heicTo({
      blob: file,
      type: 'image/jpeg',
      quality: 0.92,
    })
    if (!(jpeg instanceof Blob) || jpeg.size === 0) {
      throw new PhotoReadError('conversion')
    }
    return jpeg
  } catch (error) {
    if (error instanceof PhotoReadError) throw error
    throw new PhotoReadError('conversion')
  }
}
