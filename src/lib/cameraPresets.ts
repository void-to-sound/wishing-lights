import { ROOM_ASPECT, TREE_ANCHOR, type RoomCamera } from './roomCamera.ts'

/** Closest and widest frames the editor will store. */
export const MIN_VIEW_WIDTH = 0.08
export const MAX_VIEW_WIDTH = 1

/**
 * Framing helpers for the camera experiment.
 * Positions are fractions of a scene's artwork, from the top-left.
 * `viewWidth` is how much of that artwork's width stays in frame.
 * A smaller width moves closer.
 *
 * Shots, takes, and the cut between them live in cameraSequence.ts.
 * The home shot does not use these helpers: it keeps frameRoom.
 */
const treeBottom = 1 - TREE_ANCHOR.bottom
const treeCenterX = TREE_ANCHOR.x + TREE_ANCHOR.width / 2

/** On the floor, just to the right of the birch trunk. */
export const JEWELRY_BOX = {
  x: treeCenterX + TREE_ANCHOR.width * 0.28,
  y: treeBottom - 0.012,
}

/** Smootherstep. It leaves and arrives slowly, and does not overshoot. */
export function cinematicEase(amount: number): number {
  const t = clamp(amount, 0, 1)
  return t * t * t * (t * (t * 6 - 15) + 10)
}

export type FramingLimit = 'none' | 'height' | 'width' | 'zoom'

/**
 * How much of the artwork a viewport can show.
 * `aspect` is the artwork's width divided by its height.
 * A tall screen cannot honor a very wide view without empty edges, so the
 * shown width opens up. The requested width itself is left unchanged.
 */
export function visibleSpan(
  viewportWidth: number,
  viewportHeight: number,
  viewWidth: number,
  aspect: number = ROOM_ASPECT,
): { spanW: number; spanH: number; limited: FramingLimit } {
  if (viewportWidth <= 0 || viewportHeight <= 0 || aspect <= 0) {
    return { spanW: 1, spanH: 1, limited: 'none' }
  }
  const requested = clamp(viewWidth, MIN_VIEW_WIDTH, MAX_VIEW_WIDTH)
  let limited: FramingLimit =
    Math.abs(requested - viewWidth) > 0.001 ? 'zoom' : 'none'
  let spanW = requested
  let spanH = spanW * aspect * (viewportHeight / viewportWidth)
  if (spanH > 1) {
    spanH = 1
    spanW = viewportWidth / (viewportHeight * aspect)
    limited = 'height'
  }
  if (spanW > 1) {
    spanW = 1
    spanH = Math.min(1, spanW * aspect * (viewportHeight / viewportWidth))
    limited = 'width'
  }
  return { spanW, spanH, limited }
}

/**
 * Frames a point in one scene's artwork.
 * The view keeps the viewport's shape and stays inside the image.
 */
export function frameFocus(
  viewportWidth: number,
  viewportHeight: number,
  focusX: number,
  focusY: number,
  viewWidth: number,
  aspect: number = ROOM_ASPECT,
): RoomCamera {
  if (viewportWidth <= 0 || viewportHeight <= 0) {
    return { width: 0, height: 0, x: 0, y: 0, explore: false }
  }

  const { spanW, spanH } = visibleSpan(viewportWidth, viewportHeight, viewWidth, aspect)
  const x0 = clamp(focusX - spanW / 2, 0, Math.max(0, 1 - spanW))
  const y0 = clamp(focusY - spanH / 2, 0, Math.max(0, 1 - spanH))
  const width = viewportWidth / spanW
  const height = width / aspect
  return {
    width,
    height,
    x: -x0 * width,
    y: -y0 * height,
    explore: false,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
