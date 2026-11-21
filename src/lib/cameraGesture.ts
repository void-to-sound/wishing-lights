import {
  MAX_VIEW_WIDTH,
  MIN_VIEW_WIDTH,
  visibleSpan,
  type FramingLimit,
} from './cameraPresets.ts'
import type { CameraComposition } from './cameraSequence.ts'

/**
 * Pan and zoom for the framing editor.
 * A future motion recorder should call these same functions while it is recording.
 * Positions stay in fractions of the artwork. Screen pixels are only the gesture.
 */

/** Dragging the picture right moves the picture right. */
export function panByPixels(
  composition: CameraComposition,
  deltaX: number,
  deltaY: number,
  viewportWidth: number,
  viewportHeight: number,
  aspect: number,
): CameraComposition {
  if (viewportWidth <= 0 || viewportHeight <= 0) return composition
  const { spanW, spanH } = visibleSpan(viewportWidth, viewportHeight, composition.viewWidth, aspect)
  return settle(
    {
      focusX: composition.focusX - (deltaX / viewportWidth) * spanW,
      focusY: composition.focusY - (deltaY / viewportHeight) * spanH,
      viewWidth: composition.viewWidth,
    },
    viewportWidth,
    viewportHeight,
    aspect,
  )
}

/**
 * `factor` multiplies the view width. Greater than 1 moves away from the picture.
 * The artwork point under the cursor stays under the cursor when the frame can.
 */
export function zoomAtPoint(
  composition: CameraComposition,
  factor: number,
  cursorX: number,
  cursorY: number,
  viewportWidth: number,
  viewportHeight: number,
  aspect: number,
): CameraComposition {
  if (viewportWidth <= 0 || viewportHeight <= 0 || !Number.isFinite(factor) || factor <= 0) {
    return composition
  }
  const before = visibleSpan(viewportWidth, viewportHeight, composition.viewWidth, aspect)
  const x0 = clamp(composition.focusX - before.spanW / 2, 0, Math.max(0, 1 - before.spanW))
  const y0 = clamp(composition.focusY - before.spanH / 2, 0, Math.max(0, 1 - before.spanH))
  const anchorX = x0 + (cursorX / viewportWidth) * before.spanW
  const anchorY = y0 + (cursorY / viewportHeight) * before.spanH
  const viewWidth = clamp(composition.viewWidth * factor, MIN_VIEW_WIDTH, MAX_VIEW_WIDTH)
  const after = visibleSpan(viewportWidth, viewportHeight, viewWidth, aspect)
  const nextX0 = clamp(anchorX - (cursorX / viewportWidth) * after.spanW, 0, Math.max(0, 1 - after.spanW))
  const nextY0 = clamp(anchorY - (cursorY / viewportHeight) * after.spanH, 0, Math.max(0, 1 - after.spanH))
  return {
    focusX: nextX0 + after.spanW / 2,
    focusY: nextY0 + after.spanH / 2,
    viewWidth,
  }
}

/** Positive wheel delta moves the camera away from the picture. */
export function wheelZoomFactor(deltaY: number, deltaMode: number, viewportHeight: number): number {
  const pixels =
    deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * viewportHeight : deltaY
  return Math.exp(clamp(pixels, -400, 400) * 0.0012)
}

/** Fingers moving apart return a factor below 1, which moves closer. */
export function pinchZoomFactor(previousDistance: number, nextDistance: number): number {
  if (previousDistance <= 0 || nextDistance <= 0) return 1
  return clamp(previousDistance / nextDistance, 0.5, 2)
}

/** A sentence for the editor when this screen cannot show the saved frame exactly. */
export function framingLimitMessage(
  viewWidth: number,
  viewportWidth: number,
  viewportHeight: number,
  aspect: number,
): string | null {
  const span = visibleSpan(viewportWidth, viewportHeight, viewWidth, aspect)
  if (span.limited === 'height') {
    return `This screen is taller than the picture, so the view opens to ${span.spanW.toFixed(2)} of its width. The saved width stays ${viewWidth.toFixed(2)}. Empty edges stay hidden.`
  }
  if (span.limited === 'width') {
    return 'This screen is wider than the picture, so the full width stays in frame.'
  }
  if (span.limited === 'zoom') {
    return 'Zoom is at the closest or widest frame.'
  }
  return null
}

export function framingLimit(
  viewWidth: number,
  viewportWidth: number,
  viewportHeight: number,
  aspect: number,
): FramingLimit {
  return visibleSpan(viewportWidth, viewportHeight, viewWidth, aspect).limited
}

function settle(
  composition: CameraComposition,
  viewportWidth: number,
  viewportHeight: number,
  aspect: number,
): CameraComposition {
  const { spanW, spanH } = visibleSpan(
    viewportWidth,
    viewportHeight,
    composition.viewWidth,
    aspect,
  )
  const halfW = spanW / 2
  const halfH = spanH / 2
  return {
    focusX: clamp(composition.focusX, halfW, 1 - halfW),
    focusY: clamp(composition.focusY, halfH, 1 - halfH),
    viewWidth: clamp(composition.viewWidth, MIN_VIEW_WIDTH, MAX_VIEW_WIDTH),
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
