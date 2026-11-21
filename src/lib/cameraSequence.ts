import { JEWELRY_BOX, MAX_VIEW_WIDTH, MIN_VIEW_WIDTH, cinematicEase, frameFocus } from './cameraPresets.ts'
import { ROOM_ASPECT, ROOM_HEIGHT, ROOM_SRC, ROOM_WIDTH, TREE_FOCUS_X, frameRoom, type RoomCamera } from './roomCamera.ts'

/**
 * A small cut sequence for the camera experiment.
 *
 * Scene — the artwork being shown. A shot may point at another plate later.
 * Shot — one composition and the move inside it.
 * Take — one performance of that move. A manual take is a start and an end.
 *        A recorded take, later, is the positions captured while directing.
 * Sequence — shots played in order. Playback never blends across a cut.
 */

export interface SceneArtwork {
  id: string
  label: string
  /** Image for this scene. Swap this when a closer plate exists. */
  src: string
  width: number
  height: number
  /** The winter room's tree and ornaments belong to this picture. */
  includesRoom: boolean
  /** The wide room photograph is standing in until a real plate is added. */
  placeholder?: boolean
}

export const WINTER_ROOM_SCENE: SceneArtwork = {
  id: 'winter-room',
  label: 'Winter room',
  src: ROOM_SRC,
  width: ROOM_WIDTH,
  height: ROOM_HEIGHT,
  includesRoom: true,
}

export const JEWELRY_BOX_SCENE: SceneArtwork = {
  id: 'jewelry-box',
  label: 'Jewelry box close-up',
  src: ROOM_SRC,
  width: ROOM_WIDTH,
  height: ROOM_HEIGHT,
  includesRoom: true,
  placeholder: true,
}

export function sceneAspect(scene: SceneArtwork): number {
  return scene.height > 0 ? scene.width / scene.height : ROOM_ASPECT
}

const SCENES: Record<string, SceneArtwork> = {
  [WINTER_ROOM_SCENE.id]: WINTER_ROOM_SCENE,
  [JEWELRY_BOX_SCENE.id]: JEWELRY_BOX_SCENE,
}

export function sceneById(id: string): SceneArtwork {
  return SCENES[id] ?? WINTER_ROOM_SCENE
}

/** A camera composition in fractions of the active scene's artwork. */
export interface CameraComposition {
  focusX: number
  focusY: number
  /** Fraction of the artwork width kept in frame. Smaller is closer. */
  viewWidth: number
}

/** One camera sample. Recorded takes store a list of these with real times. */
export interface CameraSample {
  /** Milliseconds from the start of the take. */
  time: number
  /**
   * Use the production home framing for this sample.
   * `composition` is the scene-space reading shown in the developer panel.
   */
  home?: boolean
  composition: CameraComposition
}

/**
 * One performance of a shot.
 * Replace this object to swap a typed move for a recorded one.
 * `duration` is the shot length. The last sample sits at that time.
 */
export interface Take {
  id: string
  source: 'manual' | 'recorded'
  duration: number
  samples: CameraSample[]
}

export interface Shot {
  id: string
  label: string
  sceneId: string
  take: Take
}

export interface Sequence {
  id: string
  shots: Shot[]
}

export interface SequenceSample {
  shotIndex: number
  localTime: number
  sceneId: string
  camera: RoomCamera
}

/** A short, slight look toward the box. The editor replaces this once a frame is saved. */
const WIDE_ATTENTION = 0.08
const WIDE_ZOOM = 0.97
const WIDE_DURATION = 2400

/** A modest close view of the placeholder. A real plate can be framed much tighter. */
const BOX_START_WIDTH = 0.48
const BOX_END_WIDTH = 0.44
const BOX_DURATION = 1600

export function createDefaultSequence(home: CameraComposition): Sequence {
  const framed = clampComposition(home)
  const wideEnd = nudgeComposition(framed, JEWELRY_BOX.x, JEWELRY_BOX.y, WIDE_ATTENTION, WIDE_ZOOM)
  const box = clampComposition({
    focusX: JEWELRY_BOX.x,
    focusY: JEWELRY_BOX.y,
    viewWidth: BOX_START_WIDTH,
  })
  const boxCloser = clampComposition({ ...box, viewWidth: BOX_END_WIDTH })

  return {
    id: 'jewelry-box-intro',
    shots: [
      {
        id: 'wide',
        label: 'Shot 01',
        sceneId: WINTER_ROOM_SCENE.id,
        take: {
          id: 'wide-manual',
          source: 'manual',
          duration: WIDE_DURATION,
          samples: [
            { time: 0, home: true, composition: framed },
            { time: WIDE_DURATION, composition: wideEnd },
          ],
        },
      },
      {
        id: 'box',
        label: 'Shot 02',
        sceneId: JEWELRY_BOX_SCENE.id,
        take: {
          id: 'box-manual',
          source: 'manual',
          duration: BOX_DURATION,
          samples: [
            { time: 0, composition: box },
            { time: BOX_DURATION, composition: boxCloser },
          ],
        },
      },
    ],
  }
}

export function compositionFromCamera(
  camera: RoomCamera,
  viewportWidth: number,
  viewportHeight: number,
): CameraComposition {
  if (camera.width <= 0 || camera.height <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
    return { focusX: 0.5, focusY: 0.5, viewWidth: 1 }
  }
  return {
    focusX: (viewportWidth / 2 - camera.x) / camera.width,
    focusY: (viewportHeight / 2 - camera.y) / camera.height,
    viewWidth: viewportWidth / camera.width,
  }
}

export function roundComposition(composition: CameraComposition): CameraComposition {
  return {
    focusX: round(composition.focusX),
    focusY: round(composition.focusY),
    viewWidth: round(composition.viewWidth),
  }
}

/** Refresh samples that are still tied to the live home framing. */
export function retargetHome(sequence: Sequence, home: CameraComposition): Sequence {
  const composition = roundComposition(home)
  return {
    ...sequence,
    shots: sequence.shots.map((shot) => ({
      ...shot,
      take: {
        ...shot.take,
        samples: shot.take.samples.map((sample) =>
          sample.home ? { ...sample, composition } : sample,
        ),
      },
    })),
  }
}

export function withDuration(shot: Shot, duration: number): Shot {
  const next = clamp(duration, 100, 8000)
  const span = shot.take.duration || 1
  const samples = shot.take.samples.map((sample, index, list) => {
    if (index === 0) return { ...sample, time: 0 }
    if (index === list.length - 1) return { ...sample, time: next }
    return { ...sample, time: (sample.time / span) * next }
  })
  return { ...shot, take: { ...shot.take, duration: next, samples } }
}

export function withSampleComposition(
  shot: Shot,
  end: 'start' | 'end',
  composition: CameraComposition,
): Shot {
  const index = end === 'start' ? 0 : shot.take.samples.length - 1
  const samples = shot.take.samples.map((sample, sampleIndex) =>
    sampleIndex === index
      ? { ...sample, home: false, composition: clampComposition(composition) }
      : sample,
  )
  return { ...shot, take: { ...shot.take, samples } }
}

export function withHomeStart(shot: Shot, composition: CameraComposition): Shot {
  const samples = shot.take.samples.map((sample, index) =>
    index === 0
      ? { ...sample, time: 0, home: true, composition: roundComposition(composition) }
      : sample,
  )
  return { ...shot, take: { ...shot.take, samples } }
}

/**
 * The camera at `time` within one sequence.
 * Time is measured from the start of the first shot.
 * At a shot boundary the clock steps onto the next shot's first sample.
 */
export function sampleSequence(
  sequence: Sequence,
  time: number,
  viewportWidth: number,
  viewportHeight: number,
  options: { reducedMotion?: boolean; aspects?: Record<string, number> } = {},
): SequenceSample {
  const reduced = options.reducedMotion === true
  const fallback = sequence.shots[0]
  if (!fallback) {
    return {
      shotIndex: 0,
      localTime: 0,
      sceneId: WINTER_ROOM_SCENE.id,
      camera: { width: 0, height: 0, x: 0, y: 0, explore: false },
    }
  }

  let chosen = sequence.shots.length - 1
  let localTime = Math.max(0, sequence.shots[chosen]?.take.duration ?? 0)
  let elapsed = 0
  const clock = Math.max(0, time)
  for (let index = 0; index < sequence.shots.length; index += 1) {
    const duration = Math.max(0, sequence.shots[index]?.take.duration ?? 0)
    if (clock < elapsed + duration || index === sequence.shots.length - 1) {
      chosen = index
      localTime = Math.min(Math.max(0, clock - elapsed), duration)
      break
    }
    elapsed += duration
  }

  const shot = sequence.shots[chosen] ?? fallback
  return {
    shotIndex: chosen,
    localTime,
    sceneId: shot.sceneId,
    camera: sampleTake(shot.take, reduced ? 0 : localTime, viewportWidth, viewportHeight, {
      reducedMotion: reduced,
      aspect: options.aspects?.[shot.sceneId] ?? ROOM_ASPECT,
    }),
  }
}

/** Interpolate inside one take. Recorded samples stay linear; typed moves ease. */
export function sampleTake(
  take: Take,
  time: number,
  viewportWidth: number,
  viewportHeight: number,
  options: { reducedMotion?: boolean; aspect?: number } = {},
): RoomCamera {
  if (viewportWidth <= 0 || viewportHeight <= 0 || take.samples.length === 0) {
    return { width: 0, height: 0, x: 0, y: 0, explore: false }
  }

  const aspect = options.aspect && options.aspect > 0 ? options.aspect : ROOM_ASPECT
  const samples = [...take.samples].sort((a, b) => a.time - b.time)
  const first = samples[0]
  if (!first) return { width: 0, height: 0, x: 0, y: 0, explore: false }
  if (options.reducedMotion || time <= first.time) {
    return cameraFor(first, viewportWidth, viewportHeight, aspect)
  }

  const last = samples[samples.length - 1] ?? first
  if (time >= last.time) return cameraFor(last, viewportWidth, viewportHeight, aspect)

  let index = 0
  while (index < samples.length - 2 && (samples[index + 1]?.time ?? 0) < time) index += 1
  const from = samples[index] ?? first
  const to = samples[index + 1] ?? last
  const span = to.time - from.time
  if (span <= 0) return cameraFor(to, viewportWidth, viewportHeight, aspect)
  const amount = (time - from.time) / span
  const t = take.source === 'recorded' ? amount : cinematicEase(amount)
  return mixCamera(
    cameraFor(from, viewportWidth, viewportHeight, aspect),
    cameraFor(to, viewportWidth, viewportHeight, aspect),
    t,
  )
}

function cameraFor(
  sample: CameraSample,
  viewportWidth: number,
  viewportHeight: number,
  aspect: number,
): RoomCamera {
  if (sample.home) return frameRoom(viewportWidth, viewportHeight, TREE_FOCUS_X)
  return frameFocus(
    viewportWidth,
    viewportHeight,
    sample.composition.focusX,
    sample.composition.focusY,
    sample.composition.viewWidth,
    aspect,
  )
}

function mixCamera(from: RoomCamera, to: RoomCamera, amount: number): RoomCamera {
  const t = clamp(amount, 0, 1)
  if (t <= 0) return from
  if (t >= 1) return to
  return {
    width: from.width + (to.width - from.width) * t,
    height: from.height + (to.height - from.height) * t,
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    explore: false,
  }
}

function nudgeComposition(
  base: CameraComposition,
  towardX: number,
  towardY: number,
  attention: number,
  zoom: number,
): CameraComposition {
  return clampComposition({
    focusX: base.focusX + (towardX - base.focusX) * attention,
    focusY: base.focusY + (towardY - base.focusY) * attention,
    viewWidth: base.viewWidth * zoom,
  })
}

function clampComposition(composition: CameraComposition): CameraComposition {
  return {
    focusX: clamp(composition.focusX, 0, 1),
    focusY: clamp(composition.focusY, 0, 1),
    viewWidth: clamp(composition.viewWidth, MIN_VIEW_WIDTH, MAX_VIEW_WIDTH),
  }
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
