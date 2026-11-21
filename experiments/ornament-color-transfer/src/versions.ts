export interface OrnamentVersion {
  id: string
  label: string
  ornament: URL
  mask: URL
}

/** Add a version here after its image and mask exist. Do not replace an earlier entry's files. */
export const versions: OrnamentVersion[] = [
  {
    id: 'v1',
    label: 'V1 milky glass',
    ornament: new URL('../assets/v1/ornament.png', import.meta.url),
    mask: new URL('../assets/v1/recolor-mask.png', import.meta.url),
  },
  {
    id: 'v2',
    label: 'V2 faceted crystal',
    ornament: new URL('../assets/v2/ornament.png', import.meta.url),
    mask: new URL('../assets/v2/recolor-mask.png', import.meta.url),
  },
]
