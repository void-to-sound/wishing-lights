/**
 * Release 1 test audio.
 * Files live in public/audio and are served from the site root.
 * ASMR 3 is reserved here; there is no file or button for it yet.
 * Lo-fi 2 is the mp3 in that folder. The visible control starts on Lo-fi 1.
 */
export interface AudioSource {
  id: string
  label: string
  src: string
  loop: boolean
  /** Level reached at the end of a fade-in, from 0 to 1. */
  volume: number
  /** False keeps the source in configuration without a room button. */
  visible: boolean
}

export const FADE_MS = 650

export const ASMR_SOURCES: readonly AudioSource[] = [
  {
    id: 'asmr-1',
    label: 'ASMR 1',
    src: '/audio/asmr1.wav',
    loop: true,
    volume: 0.75,
    visible: true,
  },
  {
    id: 'asmr-2',
    label: 'ASMR 2',
    src: '/audio/asmr2.wav',
    loop: true,
    volume: 0.75,
    visible: true,
  },
  {
    id: 'asmr-3',
    label: 'ASMR 3',
    src: '/audio/asmr3.wav',
    loop: true,
    volume: 0.75,
    visible: false,
  },
]

export const LOFI_TRACKS: readonly AudioSource[] = [
  {
    id: 'lofi-1',
    label: 'Lo-fi 1',
    src: '/audio/lofi1.wav',
    loop: true,
    volume: 0.6,
    visible: true,
  },
  {
    id: 'lofi-2',
    label: 'Lo-fi 2',
    src: '/audio/lofi2.mp3',
    loop: true,
    volume: 0.6,
    visible: true,
  },
]

export const DEFAULT_LOFI_ID = LOFI_TRACKS[0]?.id ?? 'lofi-1'

export const VISIBLE_ASMR = ASMR_SOURCES.filter((source) => source.visible)
