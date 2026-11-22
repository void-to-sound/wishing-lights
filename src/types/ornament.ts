/** Position on the tree, as fractions of the tree box from the top-left. */
export interface TreePosition {
  x: number
  y: number
}

/** Silhouette used to draw the ornament. Only a circle exists in this prototype. */
export type OrnamentShape = 'circle'

/**
 * Surface treatment.
 * `flat` is the original color disc. The designer adds the other three.
 */
export type OrnamentMaterial = 'flat' | 'glass' | 'crystal' | 'metal'

/** A finished designer ornament, before it is stored or hung. */
export interface OrnamentDraft {
  photo: PreparedPhoto
  material: Exclude<OrnamentMaterial, 'flat'>
  colors: string[]
}

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
