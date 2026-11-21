/** Position on the tree, as fractions of the tree box from the top-left. */
export interface TreePosition {
  x: number
  y: number
}

/** Silhouette used to draw the ornament. Only a circle exists in this prototype. */
export type OrnamentShape = 'circle'

/**
 * Surface treatment. Only the flat fill is drawn today.
 * Later material experiments can extend this union.
 */
export type OrnamentMaterial = 'flat'

/** A photograph turned into an ornament. All of this lives in React state. */
export interface Ornament {
  id: string
  /** Browser object URL for the original photograph. Not uploaded anywhere. */
  photoUrl: string
  /** Representative colors from the photograph, as #rrggbb strings. */
  colors: string[]
  shape: OrnamentShape
  material: OrnamentMaterial
  /** Null until the user taps the tree to hang the ornament. */
  position: TreePosition | null
  message: string
  /** Reserved for a future sound. Unused in this prototype. */
  soundId: string | null
}

/** Result of reading a photograph, before it becomes an ornament. */
export interface PreparedPhoto {
  /** Temporary object URL for the preview. Not stored. */
  photoUrl: string
  /** Display photo to persist. The object URL is rebuilt from this after a reload. */
  photo: Blob
  colors: string[]
}
