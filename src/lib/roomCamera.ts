/**
 * The expanded winter room and the view into it.
 * Coordinates are fractions of the photograph, from the top-left.
 * One camera transform moves the photograph, the effects, and every object.
 */

export const ROOM_WIDTH = 1024
export const ROOM_HEIGHT = 512
export const ROOM_ASPECT = ROOM_WIDTH / ROOM_HEIGHT
export const ROOM_SRC = '/assets/winter-room.jpg'

/**
 * The previous photograph, found inside the expanded image.
 * This is the composition a normal laptop should keep: tree at the left
 * window, fireplace on the right, ceiling molding, and the reflective floor.
 */
export const PREFERRED_FRAME = {
  x: 72 / ROOM_WIDTH,
  y: 56 / ROOM_HEIGHT,
  width: 799 / ROOM_WIDTH,
  height: 449 / ROOM_HEIGHT,
} as const

const TREE_WITHIN_FRAME = { x: 0.055, width: 0.28, bottom: 0.105 }

/** The birch, in fractions of the expanded photograph. */
export const TREE_ANCHOR = {
  x: PREFERRED_FRAME.x + TREE_WITHIN_FRAME.x * PREFERRED_FRAME.width,
  width: TREE_WITHIN_FRAME.width * PREFERRED_FRAME.width,
  bottom:
    1 -
    (PREFERRED_FRAME.y +
      PREFERRED_FRAME.height * (1 - TREE_WITHIN_FRAME.bottom)),
} as const

/** Horizontal center of the tree. Portrait mode starts here. */
export const TREE_FOCUS_X = TREE_ANCHOR.x + TREE_ANCHOR.width / 2

export interface RoomCamera {
  width: number
  height: number
  x: number
  y: number
  /** Portrait view: the scene is wider than the screen and can slide sideways. */
  explore: boolean
}

/**
 * Places the photograph in the viewport.
 * Wide screens keep the preferred frame fully visible and reveal more of the
 * room when there is room to do so. They do not zoom in just to cover a wider
 * screen. Portrait screens fit that same vertical slice and look toward `lookX`.
 */
export function frameRoom(
  viewportWidth: number,
  viewportHeight: number,
  lookX: number = TREE_FOCUS_X,
): RoomCamera {
  if (viewportWidth <= 0 || viewportHeight <= 0) {
    return { width: 0, height: 0, x: 0, y: 0, explore: false }
  }

  const frame = PREFERRED_FRAME
  const explore = viewportHeight > viewportWidth
  const fittedWidth = explore
    ? (viewportHeight * ROOM_ASPECT) / frame.height
    : Math.min(viewportWidth / frame.width, (viewportHeight * ROOM_ASPECT) / frame.height)
  const width = fittedWidth
  const height = width / ROOM_ASPECT

  if (explore) {
    const y = coverOffset(-frame.y * height, height, viewportHeight)
    const x = coverOffset(viewportWidth / 2 - lookX * width, width, viewportWidth)
    return { width, height, x, y, explore: width > viewportWidth + 1 }
  }

  const x = coverOffset(
    viewportWidth / 2 - (frame.x + frame.width / 2) * width,
    width,
    viewportWidth,
  )
  const y = coverOffset(
    viewportHeight / 2 - (frame.y + frame.height / 2) * height,
    height,
    viewportHeight,
  )
  return { width, height, x, y, explore: false }
}

/** Keeps a point of the photograph inside the horizontal pan range. */
export function clampLook(viewportWidth: number, sceneWidth: number, lookX: number): number {
  if (sceneWidth <= viewportWidth || sceneWidth <= 0) return TREE_FOCUS_X
  const half = viewportWidth / (2 * sceneWidth)
  return clamp(lookX, half, 1 - half)
}

function coverOffset(offset: number, size: number, viewport: number): number {
  if (size >= viewport) return clamp(offset, viewport - size, 0)
  return (viewport - size) / 2
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
