import { describe, expect, it } from 'vitest'
import { JEWELRY_BOX, cinematicEase, frameFocus } from './cameraPresets.ts'
import {
  JEWELRY_BOX_SCENE,
  WINTER_ROOM_SCENE,
  compositionFromCamera,
  createDefaultSequence,
  retargetHome,
  roundComposition,
  sampleSequence,
  sceneById,
  withDuration,
  withSampleComposition,
  type Take,
} from './cameraSequence.ts'
import { ROOM_SRC, frameRoom } from './roomCamera.ts'

function visible(camera: { width: number; height: number; x: number; y: number }, vw: number, vh: number) {
  return {
    x0: -camera.x / camera.width,
    x1: (vw - camera.x) / camera.width,
    y0: -camera.y / camera.height,
    y1: (vh - camera.y) / camera.height,
  }
}

function laptopSequence() {
  const homeCamera = frameRoom(1600, 900)
  const home = compositionFromCamera(homeCamera, 1600, 900)
  return { homeCamera, sequence: createDefaultSequence(home) }
}

describe('sampleSequence', () => {
  it('opens on the production home framing and only drifts during shot 01', () => {
    const { homeCamera, sequence } = laptopSequence()
    const start = sampleSequence(sequence, 0, 1600, 900)
    const cut = sequence.shots[0]?.take.duration ?? 0
    const beforeCut = sampleSequence(sequence, cut - 16, 1600, 900)

    expect(start.shotIndex).toBe(0)
    expect(start.sceneId).toBe('winter-room')
    expect(start.camera).toEqual(homeCamera)
    expect(beforeCut.shotIndex).toBe(0)
    expect(beforeCut.camera.width / homeCamera.width).toBeGreaterThan(1.02)
    expect(beforeCut.camera.width / homeCamera.width).toBeLessThan(1.2)
  })

  it('cuts to shot 02 without visiting the cameras in between', () => {
    const { sequence } = laptopSequence()
    const cut = sequence.shots[0]?.take.duration ?? 0
    const total = sequence.shots.reduce((sum, shot) => sum + shot.take.duration, 0)
    const widths: number[] = []
    const shotIndexes: number[] = []
    for (let time = 0; time <= total; time += 20) {
      const sample = sampleSequence(sequence, time, 1600, 900)
      widths.push(sample.camera.width)
      shotIndexes.push(sample.shotIndex)
    }

    const before = widths.filter((_, index) => shotIndexes[index] === 0)
    const after = widths.filter((_, index) => shotIndexes[index] === 1)
    const widestWide = Math.max(...before)
    const closestClose = Math.min(...after)
    expect(closestClose).toBeGreaterThan(widestWide * 1.5)
    for (const width of widths) {
      expect(width > widestWide + 1 && width < closestClose - 1).toBe(false)
    }

    const arrived = sampleSequence(sequence, cut, 1600, 900)
    expect(arrived.shotIndex).toBe(1)
    expect(arrived.localTime).toBe(0)
    expect(arrived.sceneId).toBe('jewelry-box')
  })

  it('lands on shot 02’s own first frame at the cut', () => {
    const { sequence } = laptopSequence()
    const cut = sequence.shots[0]?.take.duration ?? 0
    const shot = sequence.shots[1]
    const start = shot?.take.samples[0]?.composition
    expect(shot).toBeDefined()
    expect(start).toBeDefined()
    if (!shot || !start) return
    const arrived = sampleSequence(sequence, cut, 1600, 900)
    expect(arrived.camera).toEqual(
      frameFocus(1600, 900, start.focusX, start.focusY, start.viewWidth),
    )
    const held = sampleSequence(sequence, cut + shot.take.duration, 1600, 900)
    const end = shot.take.samples[1]?.composition
    expect(end).toBeDefined()
    if (!end) return
    expect(held.camera.width).toBeGreaterThan(arrived.camera.width)
    expect(held.camera.width / arrived.camera.width).toBeLessThan(1.3)
  })

  it('moves the cut when shot 01’s duration changes', () => {
    const { sequence } = laptopSequence()
    const wide = sequence.shots[0]
    const box = sequence.shots[1]
    expect(wide && box).toBeTruthy()
    if (!wide || !box) return
    const edited = { ...sequence, shots: [withDuration(wide, 400), box] }
    expect(sampleSequence(edited, 399, 1600, 900).shotIndex).toBe(0)
    expect(sampleSequence(edited, 400, 1600, 900).shotIndex).toBe(1)
    expect(sampleSequence(edited, 400, 1600, 900).localTime).toBe(0)
  })

  it('holds each shot still when motion is reduced, then cuts', () => {
    const { homeCamera, sequence } = laptopSequence()
    const cut = sequence.shots[0]?.take.duration ?? 0
    const early = sampleSequence(sequence, 0, 1600, 900, { reducedMotion: true })
    const late = sampleSequence(sequence, cut - 1, 1600, 900, { reducedMotion: true })
    const next = sampleSequence(sequence, cut, 1600, 900, { reducedMotion: true })
    expect(early.camera).toEqual(homeCamera)
    expect(late.camera).toEqual(early.camera)
    expect(next.shotIndex).toBe(1)
    expect(next.camera).toEqual(sampleSequence(sequence, cut, 1600, 900).camera)
  })

  it('keeps portrait and landscape frames inside the photograph', () => {
    for (const [width, height] of [
      [390, 844],
      [844, 390],
    ] as const) {
      const home = compositionFromCamera(frameRoom(width, height), width, height)
      const sequence = createDefaultSequence(home)
      const total = sequence.shots.reduce((sum, shot) => sum + shot.take.duration, 0)
      for (let time = 0; time <= total; time += 200) {
        const camera = sampleSequence(sequence, time, width, height).camera
        const view = visible(camera, width, height)
        expect(view.x0).toBeGreaterThanOrEqual(-0.001)
        expect(view.y0).toBeGreaterThanOrEqual(-0.001)
        expect(view.x1).toBeLessThanOrEqual(1.001)
        expect(view.y1).toBeLessThanOrEqual(1.001)
      }
      expect(sampleSequence(sequence, 0, width, height).camera).toEqual(frameRoom(width, height))
    }
  })

  it('keeps the close-up width when the home crop changes', () => {
    const wide = createDefaultSequence(compositionFromCamera(frameRoom(1600, 900), 1600, 900))
    const tall = createDefaultSequence(compositionFromCamera(frameRoom(390, 844), 390, 844))
    expect(tall.shots[1]?.take.samples[0]?.composition.viewWidth).toBe(
      wide.shots[1]?.take.samples[0]?.composition.viewWidth,
    )
    const arrived = sampleSequence(tall, tall.shots[0]?.take.duration ?? 0, 390, 844)
    const view = visible(arrived.camera, 390, 844)
    expect(view.x0).toBeGreaterThanOrEqual(-0.001)
    expect(view.x1).toBeLessThanOrEqual(1.001)
    expect(view.x0).toBeLessThanOrEqual(JEWELRY_BOX.x)
    expect(view.x1).toBeGreaterThanOrEqual(JEWELRY_BOX.x)
  })

  it('frames a square plate with its own aspect', () => {
    const { sequence } = laptopSequence()
    const cut = sequence.shots[0]?.take.duration ?? 0
    const square = sampleSequence(sequence, cut, 800, 800, { aspects: { 'jewelry-box': 1 } })
    expect(square.camera.width / square.camera.height).toBeCloseTo(1, 5)
    const room = sampleSequence(sequence, cut, 800, 800)
    expect(room.camera.width / room.camera.height).toBeCloseTo(2, 5)
  })

  it('still cuts closer on a landscape phone', () => {
    const homeCamera = frameRoom(844, 390)
    const sequence = createDefaultSequence(compositionFromCamera(homeCamera, 844, 390))
    const cut = sequence.shots[0]?.take.duration ?? 0
    const arrived = sampleSequence(sequence, cut, 844, 390)
    expect(arrived.camera.width).toBeGreaterThan(homeCamera.width * 1.5)
  })

  it('plays a recorded take inside its shot and still cuts into it', () => {
    const { sequence } = laptopSequence()
    const recorded: Take = {
      id: 'box-recorded',
      source: 'recorded',
      duration: 1000,
      samples: [
        { time: 0, composition: { focusX: 0.3, focusY: 0.8, viewWidth: 0.4 } },
        { time: 500, composition: { focusX: 0.32, focusY: 0.8, viewWidth: 0.36 } },
        { time: 1000, composition: { focusX: 0.34, focusY: 0.8, viewWidth: 0.33 } },
      ],
    }
    const wide = sequence.shots[0]
    const box = sequence.shots[1]
    expect(wide && box).toBeTruthy()
    if (!wide || !box) return
    const next = { ...sequence, shots: [wide, { ...box, take: recorded }] }
    const cut = wide.take.duration
    const arrived = sampleSequence(next, cut, 1600, 900)
    const first = frameFocus(1600, 900, 0.3, 0.8, 0.4)
    const second = frameFocus(1600, 900, 0.32, 0.8, 0.36)
    expect(arrived.camera).toEqual(first)

    const midway = sampleSequence(next, cut + 100, 1600, 900)
    const linear = first.width + (second.width - first.width) * 0.2
    const eased = first.width + (second.width - first.width) * cinematicEase(0.2)
    expect(midway.camera.width).toBeCloseTo(linear, 4)
    expect(Math.abs(midway.camera.width - eased)).toBeGreaterThan(1)
    expect(sampleSequence(next, cut - 16, 1600, 900).shotIndex).toBe(0)
  })
})

describe('sequence artwork', () => {
  it('gives shot 02 its own scene without a new image yet', () => {
    const home = compositionFromCamera(frameRoom(1600, 900), 1600, 900)
    const sequence = createDefaultSequence(home)
    expect(sequence.shots[0]?.sceneId).toBe(WINTER_ROOM_SCENE.id)
    expect(sequence.shots[1]?.sceneId).toBe(JEWELRY_BOX_SCENE.id)
    expect(sceneById('jewelry-box').placeholder).toBe(true)
    expect(sceneById('jewelry-box').src).toBe(ROOM_SRC)
    expect(sceneById('jewelry-box').includesRoom).toBe(true)
    expect(sceneById('missing').id).toBe('winter-room')
  })

  it('keeps a typed ending when the home framing is refreshed', () => {
    const home = compositionFromCamera(frameRoom(1600, 900), 1600, 900)
    const sequence = createDefaultSequence(home)
    const wide = sequence.shots[0]
    expect(wide).toBeDefined()
    if (!wide) return
    const edited = {
      ...sequence,
      shots: [
        withSampleComposition(wide, 'end', { focusX: 0.5, focusY: 0.5, viewWidth: 0.6 }),
        ...sequence.shots.slice(1),
      ],
    }
    const refreshed = retargetHome(edited, { focusX: 0.41, focusY: 0.52, viewWidth: 0.74 })
    expect(refreshed.shots[0]?.take.samples[0]).toMatchObject({
      home: true,
      composition: roundComposition({ focusX: 0.41, focusY: 0.52, viewWidth: 0.74 }),
    })
    expect(refreshed.shots[0]?.take.samples[1]?.composition).toEqual({
      focusX: 0.5,
      focusY: 0.5,
      viewWidth: 0.6,
    })
  })
})
