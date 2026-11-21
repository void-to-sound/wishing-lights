/** Shared room geometry. Overlays use the same boxes as the wall cutouts. */

export const SCENE_W = 1600
export const SCENE_H = 1000

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** Glass opening on the left wall, behind the branch tree. */
export const GLASS: Box = { x: 108, y: 96, w: 544, h: 436 }

export const MUNTIN = 14

/** Dark firebox. The glow is painted inside this rectangle. */
export const FIRE: Box = { x: 1096, y: 492, w: 196, h: 176 }

export const FLOOR_Y = 748

export function panes(glass: Box = GLASS, muntin = MUNTIN): Box[] {
  const cols = 3
  const rows = 2
  const paneW = (glass.w - muntin * (cols - 1)) / cols
  const paneH = (glass.h - muntin * (rows - 1)) / rows
  const openings: Box[] = []
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      openings.push({
        x: glass.x + col * (paneW + muntin),
        y: glass.y + row * (paneH + muntin),
        w: paneW,
        h: paneH,
      })
    }
  }
  return openings
}

export function frameAround(glass: Box, pad: number): Box {
  return {
    x: glass.x - pad,
    y: glass.y - pad,
    w: glass.w + pad * 2,
    h: glass.h + pad * 2,
  }
}

/** Percentages of the stage, for HTML overlays that sit on the SVG. */
export function place(box: Box): {
  left: string
  top: string
  width: string
  height: string
} {
  return {
    left: `${(box.x / SCENE_W) * 100}%`,
    top: `${(box.y / SCENE_H) * 100}%`,
    width: `${(box.w / SCENE_W) * 100}%`,
    height: `${(box.h / SCENE_H) * 100}%`,
  }
}
