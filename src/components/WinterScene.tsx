import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { LofiAudioControls, MantelAudioControls } from './AudioControls.tsx'
import { CameraExperiment } from './CameraExperiment.tsx'
import { JewelryHotspot, JewelryStage } from './JewelryBox.tsx'
import { OrnamentDesigner } from './OrnamentDesigner.tsx'
import { Ornament } from './Ornament.tsx'
import { useJewelryVisit } from './useJewelryVisit.ts'
import { framingLimitMessage, panByPixels, pinchZoomFactor, wheelZoomFactor, zoomAtPoint } from '../lib/cameraGesture.ts'
import { frameFocus } from '../lib/cameraPresets.ts'
import {
  JEWELRY_BOX_SCENE,
  WINTER_ROOM_SCENE,
  compositionFromCamera,
  createDefaultSequence,
  retargetHome,
  roundComposition,
  sampleSequence,
  sceneAspect,
  sceneById,
  withDuration,
  withSampleComposition,
  type CameraComposition,
  type SceneArtwork,
  type Sequence,
} from '../lib/cameraSequence.ts'
import { applyFraming, framingFromSequence, readFraming, writeFraming, type StoredFraming } from '../lib/framingStore.ts'
import { jewelryStagePoint } from '../lib/jewelryBox.ts'
import { deletePlate, loadPlate, readImageFile, savePlate } from '../lib/plateStore.ts'
import {
  ROOM_ASPECT,
  ROOM_SRC,
  TREE_FOCUS_X,
  clampLook,
  frameRoom,
  type RoomCamera,
} from '../lib/roomCamera.ts'
import type { OrnamentDraft } from '../types/ornament.ts'

interface WinterSceneProps {
  children: ReactNode
  /** Developer camera sequence. Off unless the page is opened with ?camera. */
  experiment?: boolean
  /** True while the jewelry-box visit is away from the resting room. */
  onVisitChange?: (active: boolean) => void
  /** Called once, when a designed ornament is ready to hang. */
  onOrnamentCommit?: (draft: OrnamentDraft) => void
}

interface PlateView {
  url: string
  width: number
  height: number
  name: string
}

const DRAG_THRESHOLD = 10
const LOOP_HOLD = 800

/**
 * The photograph is the coordinate space for every object in the room.
 * One transform moves that whole space, so the tree and ornaments stay locked
 * to the picture. The experiment edits and plays named shots. It does not
 * replace the home camera.
 */
export function WinterScene({
  children,
  experiment = false,
  onVisitChange,
  onOrnamentCommit,
}: WinterSceneProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const [lookX, setLookX] = useState(TREE_FOCUS_X)
  const [dragging, setDragging] = useState(false)
  const [framing, setFraming] = useState<StoredFraming | null>(() => readFraming())
  const [edits, setEdits] = useState<Sequence | null>(null)
  const [dirty, setDirty] = useState(false)
  const [editShot, setEditShot] = useState(0)
  const [editEnd, setEditEnd] = useState<'start' | 'end'>('start')
  const [activity, setActivity] = useState<'edit' | 'play'>('edit')
  const [held, setHeld] = useState<RoomCamera | null>(null)
  const [activeShot, setActiveShot] = useState<number | null>(0)
  const [playing, setPlaying] = useState(false)
  const [runMode, setRunMode] = useState<'sequence' | 'shot' | null>(null)
  const [loop, setLoop] = useState(false)
  const [runId, setRunId] = useState(0)
  const [plate, setPlate] = useState<PlateView | null>(null)
  const [plateError, setPlateError] = useState<string | null>(null)
  const viewportRef = useRef(viewport)
  const sequenceRef = useRef<Sequence | null>(null)
  const loopRef = useRef(loop)
  const aspectsRef = useRef<Record<string, number>>({})
  const aspectRef = useRef(ROOM_ASPECT)
  const compositionRef = useRef<CameraComposition | null>(null)
  const editShotRef = useRef(editShot)
  const editEndRef = useRef(editEnd)
  const editingRef = useRef(false)
  const draggingEdit = useRef(false)
  const plateUrl = useRef<string | null>(null)
  const runToken = useRef(0)
  const modeRef = useRef<'sequence' | 'shot'>('sequence')
  const shotIndexRef = useRef(0)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchDistance = useRef(0)
  const drag = useRef({
    pointer: -1,
    startX: 0,
    startLook: TREE_FOCUS_X,
    moved: false,
  })
  const suppressClick = useRef(false)
  const gliding = useRef(false)

  useLayoutEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const measure = () => {
      const rect = frame.getBoundingClientRect()
      setViewport({ width: rect.width, height: rect.height })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    loadPlate()
      .then((stored) => {
        if (cancelled || !stored) return
        const url = URL.createObjectURL(stored.blob)
        plateUrl.current = url
        setPlate({ url, width: stored.width, height: stored.height, name: stored.name })
      })
      .catch(() => {
        if (!cancelled) setPlateError('Close-up images cannot be stored in this browser.')
      })
    return () => {
      cancelled = true
      if (plateUrl.current) URL.revokeObjectURL(plateUrl.current)
      plateUrl.current = null
    }
  }, [experiment])

  const home = useMemo(() => {
    if (viewport.width <= 0) return null
    return roundComposition(
      compositionFromCamera(
        frameRoom(viewport.width, viewport.height, TREE_FOCUS_X),
        viewport.width,
        viewport.height,
      ),
    )
  }, [viewport.width, viewport.height])

  const draft = useMemo(() => {
    if (!experiment || !home) return null
    const base = framing ? applyFraming(createDefaultSequence(home), framing) : createDefaultSequence(home)
    const seeded = retargetHome(base, home)
    return edits ? retargetHome(edits, home) : seeded
  }, [experiment, home, framing, edits])

  const homeCamera = frameRoom(viewport.width, viewport.height, lookX)
  const boxScene: SceneArtwork = plate
    ? {
        id: JEWELRY_BOX_SCENE.id,
        label: plate.name,
        src: plate.url,
        width: plate.width,
        height: plate.height,
        includesRoom: false,
      }
    : JEWELRY_BOX_SCENE
  const aspects = {
    [WINTER_ROOM_SCENE.id]: sceneAspect(WINTER_ROOM_SCENE),
    [JEWELRY_BOX_SCENE.id]: sceneAspect(boxScene),
  }
  const approach = useMemo(() => {
    if (experiment || !home) return null
    const base = framing ? applyFraming(createDefaultSequence(home), framing) : createDefaultSequence(home)
    return retargetHome(base, home)
  }, [experiment, home, framing])
  const visit = useJewelryVisit({
    enabled: !experiment,
    viewport,
    sequence: approach,
    aspects,
    onCommit: onOrnamentCommit,
    onActive: onVisitChange,
  })
  const editing = Boolean(experiment && activity === 'edit' && !playing && draft)
  const editedShot = draft?.shots[editShot]
  const editedSample = editedShot
    ? editEnd === 'start'
      ? editedShot.take.samples[0]
      : editedShot.take.samples[editedShot.take.samples.length - 1]
    : null
  const editedScene = editedShot ? artworkFor(editedShot.sceneId, boxScene) : WINTER_ROOM_SCENE
  const editCamera =
    editedSample && viewport.width > 0
      ? editedSample.home
        ? frameRoom(viewport.width, viewport.height, TREE_FOCUS_X)
        : frameFocus(
            viewport.width,
            viewport.height,
            editedSample.composition.focusX,
            editedSample.composition.focusY,
            editedSample.composition.viewWidth,
            sceneAspect(editedScene),
          )
      : null
  const visitArtwork = !experiment && visit.sceneId ? artworkFor(visit.sceneId, boxScene) : null
  const camera = experiment
    ? !editCamera
      ? homeCamera
      : activity === 'play' && held
        ? held
        : editCamera
    : (visit.camera ?? homeCamera)
  const shownScene =
    !experiment || !draft
      ? WINTER_ROOM_SCENE
      : activity === 'play' && activeShot != null
        ? artworkFor(draft.shots[activeShot]?.sceneId ?? WINTER_ROOM_SCENE.id, boxScene)
        : editedScene
  const showRoom = experiment ? shownScene.includesRoom : !visitArtwork || visitArtwork.includesRoom

  useLayoutEffect(() => {
    viewportRef.current = viewport
    sequenceRef.current = draft
    loopRef.current = loop
    aspectsRef.current = aspects
    aspectRef.current = sceneAspect(editedScene)
    editShotRef.current = editShot
    editEndRef.current = editEnd
    editingRef.current = editing
    if (!draggingEdit.current && editedSample && viewport.width > 0) {
      compositionRef.current = editedSample.home
        ? compositionFromCamera(
            frameRoom(viewport.width, viewport.height, TREE_FOCUS_X),
            viewport.width,
            viewport.height,
          )
        : editedSample.composition
    }
  })

  useEffect(() => {
    const frame = frameRef.current
    if (!frame || !experiment) return
    const onWheel = (event: WheelEvent) => {
      if (!editingRef.current || !compositionRef.current) return
      if (event.target instanceof Element && event.target.closest('.camera-experiment')) return
      event.preventDefault()
      const rect = frame.getBoundingClientRect()
      const next = zoomAtPoint(
        compositionRef.current,
        wheelZoomFactor(event.deltaY, event.deltaMode, rect.height),
        event.clientX - rect.left,
        event.clientY - rect.top,
        rect.width,
        rect.height,
        aspectRef.current,
      )
      compositionRef.current = next
      commitComposition(next)
    }
    frame.addEventListener('wheel', onWheel, { passive: false })
    return () => frame.removeEventListener('wheel', onWheel)
  }, [experiment])

  useEffect(() => {
    if (!experiment || !playing) return
    const token = runToken.current
    gliding.current = true
    let start = performance.now()
    let frame = 0

    const tick = (now: number) => {
      if (runToken.current !== token) return
      const seq = sequenceRef.current
      const view = viewportRef.current
      if (!seq || view.width <= 0) {
        frame = requestAnimationFrame(tick)
        return
      }
      const preview = modeRef.current === 'shot' ? shotIndexRef.current : null
      const shot = preview == null ? null : seq.shots[preview]
      const timeline = preview == null || !shot ? seq : { id: seq.id, shots: [shot] }
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const total = timeline.shots.reduce((sum, item) => sum + item.take.duration, 0)
      const looping = preview == null && loopRef.current
      const span = total + (looping ? LOOP_HOLD : 0)
      let time = now - start
      if (time >= span) {
        if (looping) {
          start = now
          time = 0
        } else {
          const end = sampleSequence(timeline, total, view.width, view.height, {
            reducedMotion: reduced,
            aspects: aspectsRef.current,
          })
          gliding.current = false
          setHeld(end.camera)
          setActiveShot(preview ?? end.shotIndex)
          setPlaying(false)
          return
        }
      }
      const sample = sampleSequence(timeline, Math.min(time, total), view.width, view.height, {
        reducedMotion: reduced,
        aspects: aspectsRef.current,
      })
      setHeld(sample.camera)
      setActiveShot(preview ?? sample.shotIndex)
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      if (runToken.current === token) gliding.current = false
    }
  }, [experiment, playing, runId])

  function commitComposition(next: CameraComposition) {
    const index = editShotRef.current
    const end = editEndRef.current
    setEdits((current) => {
      const base = current ?? sequenceRef.current
      if (!base) return current
      return {
        ...base,
        shots: base.shots.map((shot, shotIndex) =>
          shotIndex === index ? withSampleComposition(shot, end, next) : shot,
        ),
      }
    })
    setDirty(true)
  }

  function stopPlayback() {
    runToken.current += 1
    gliding.current = false
    setPlaying(false)
    setHeld(null)
    setRunMode(null)
  }

  function showSample(mode: 'sequence' | 'shot', index: number) {
    const seq = sequenceRef.current
    const view = viewportRef.current
    if (!seq || view.width <= 0) return
    const shot = seq.shots[index]
    runToken.current += 1
    modeRef.current = mode
    shotIndexRef.current = index
    const timeline = mode === 'shot' && shot ? { id: seq.id, shots: [shot] } : seq
    const sample = sampleSequence(timeline, 0, view.width, view.height, {
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      aspects: aspectsRef.current,
    })
    gliding.current = true
    draggingEdit.current = false
    setHeld(sample.camera)
    setActiveShot(mode === 'shot' ? index : 0)
    setRunMode(mode)
    setActivity('play')
    setPlaying(true)
    setRunId((count) => count + 1)
  }

  function beginEdit(index: number, end: 'start' | 'end') {
    stopPlayback()
    setActivity('edit')
    setEditShot(index)
    setEditEnd(end)
    setActiveShot(index)
  }

  function saveFraming() {
    const current = sequenceRef.current
    if (!current) return
    writeFraming(current)
    setFraming(framingFromSequence(current))
    setEdits(null)
    setDirty(false)
  }

  function revertFraming() {
    setEdits(null)
    setDirty(false)
  }

  function resetDefault() {
    if (!home) return
    setEdits(createDefaultSequence(home))
    setDirty(true)
  }

  async function choosePlate(file: File) {
    try {
      const stored = await readImageFile(file)
      await savePlate(stored)
      const url = URL.createObjectURL(stored.blob)
      if (plateUrl.current) URL.revokeObjectURL(plateUrl.current)
      plateUrl.current = url
      setPlate({ url, width: stored.width, height: stored.height, name: stored.name })
      setPlateError(null)
    } catch (error) {
      setPlateError(error instanceof Error ? error.message : 'That image could not be read.')
    }
  }

  async function removePlate() {
    try {
      await deletePlate()
    } catch {
      setPlateError('The close-up image could not be removed.')
      return
    }
    if (plateUrl.current) URL.revokeObjectURL(plateUrl.current)
    plateUrl.current = null
    setPlate(null)
    setPlateError(null)
  }

  function editDuration(duration: number) {
    const index = editShotRef.current
    setEdits((current) => {
      const base = current ?? sequenceRef.current
      if (!base) return current
      return {
        ...base,
        shots: base.shots.map((shot, shotIndex) =>
          shotIndex === index ? withDuration(shot, duration) : shot,
        ),
      }
    })
    setDirty(true)
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.target instanceof Element && event.target.closest('.camera-experiment, .jewelry-stage, .ornament-atelier, .jewelry-hit, .audio-controls')) {
      return
    }
    if (!experiment && visit.phase !== 'closed') return
    if (playing || gliding.current) {
      suppressClick.current = true
      return
    }
    if (editingRef.current && event.button === 0) {
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (pointers.current.size >= 2) pinchDistance.current = distanceBetween(pointers.current)
      draggingEdit.current = true
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // A pointer can end before the browser accepts capture.
      }
      return
    }
    if (!camera.explore || event.button !== 0) return
    drag.current = {
      pointer: event.pointerId,
      startX: event.clientX,
      startLook: lookX,
      moved: false,
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // A pointer can end before the browser accepts capture.
    }
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const tracked = pointers.current.get(event.pointerId)
    if (tracked && compositionRef.current && frameRef.current) {
      const previous = tracked
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
      const rect = frameRef.current.getBoundingClientRect()
      if (event.clientX === previous.x && event.clientY === previous.y && pointers.current.size < 2) return
      if (pointers.current.size >= 2) {
        const distance = distanceBetween(pointers.current)
        const center = centerOf(pointers.current)
        const factor = pinchZoomFactor(pinchDistance.current, distance)
        pinchDistance.current = distance
        if (Math.abs(factor - 1) < 0.001) return
        const next = zoomAtPoint(
          compositionRef.current,
          factor,
          center.x - rect.left,
          center.y - rect.top,
          rect.width,
          rect.height,
          aspectRef.current,
        )
        compositionRef.current = next
        suppressClick.current = true
        setDragging(true)
        commitComposition(next)
        return
      }
      const next = panByPixels(
        compositionRef.current,
        event.clientX - previous.x,
        event.clientY - previous.y,
        rect.width,
        rect.height,
        aspectRef.current,
      )
      compositionRef.current = next
      suppressClick.current = true
      setDragging(true)
      commitComposition(next)
      return
    }
    if (event.pointerId !== drag.current.pointer || camera.width <= 0) return
    const distance = event.clientX - drag.current.startX
    if (!drag.current.moved && Math.abs(distance) < DRAG_THRESHOLD) return
    drag.current.moved = true
    setDragging(true)
    setLookX(clampLook(viewport.width, camera.width, drag.current.startLook - distance / camera.width))
  }

  function finishPointer(event: PointerEvent<HTMLDivElement>) {
    if (pointers.current.has(event.pointerId)) {
      pointers.current.delete(event.pointerId)
      if (pointers.current.size < 2) pinchDistance.current = 0
      if (pointers.current.size === 0) {
        draggingEdit.current = false
        setDragging(false)
      }
      return
    }
    if (event.pointerId !== drag.current.pointer) return
    if (drag.current.moved) suppressClick.current = true
    drag.current.pointer = -1
    setDragging(false)
  }

  function onClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (
      event.target instanceof Element &&
      event.target.closest('.camera-experiment, .jewelry-stage, .ornament-atelier, .jewelry-hit, .audio-controls')
    ) {
      return
    }
    if (!experiment && visit.phase !== 'closed') {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    if (!editingRef.current && !suppressClick.current && !gliding.current) return
    event.preventDefault()
    event.stopPropagation()
    suppressClick.current = false
  }

  const exploring = !editing && held === null && visit.phase === 'closed' && camera.explore
  const frameClass = [
    'scene-frame',
    exploring ? 'is-exploring' : '',
    editing ? 'is-framing' : '',
    dragging ? 'is-dragging' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const shotId = !experiment
    ? undefined
    : activity === 'play' && activeShot != null
      ? (draft?.shots[activeShot]?.id ?? 'home')
      : (editedShot?.id ?? 'home')
  const limit =
    editing && editedSample
      ? framingLimitMessage(
          editedSample.composition.viewWidth,
          viewport.width,
          viewport.height,
          sceneAspect(editedScene),
        )
      : null
  const status = !experiment
    ? ''
    : playing && runMode === 'sequence'
      ? 'Playing sequence'
      : playing
        ? 'Playing shot'
        : activity === 'play'
          ? 'Holding'
          : `Editing ${editedShot?.label ?? 'Shot 01'} ${editEnd}`

  return (
    <div
      ref={frameRef}
      className={frameClass}
      {...(experiment && shotId ? { 'data-camera-shot': shotId, 'data-camera-end': editEnd } : {})}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
      onClickCapture={onClickCapture}
    >
      <div
        className="scene"
        style={{
          width: camera.width,
          height: camera.height,
          transform: `translate3d(${camera.x}px, ${camera.y}px, 0)`,
        }}
      >
        <img
          className="scene-background"
          src={experiment ? shownScene.src : (visitArtwork?.src ?? ROOM_SRC)}
          alt=""
          draggable={false}
        />
        <div className="scene-effects" />
        <div className="scene-objects">
          {showRoom ? children : null}
          {!experiment ? (
            <JewelryStage
              phase={visit.phase}
              lid={visit.lid}
              anchor={jewelryStagePoint(plate !== null && visit.sceneId === JEWELRY_BOX_SCENE.id)}
            />
          ) : null}
          {!experiment && visit.phase === 'closed' ? <JewelryHotspot onOpen={visit.activate} /> : null}
          {!experiment ? <MantelAudioControls hidden={!showRoom} /> : null}
        </div>
      </div>
      {!experiment ? <LofiAudioControls /> : null}
      {!experiment && visit.photoUrl && (visit.phase === 'open' || visit.phase === 'designing') && visit.camera ? (
        <div
          className="floating-ornament"
          style={floatingStyle(stageAnchor(visit.camera, visit.sceneId, plate !== null))}
        >
          <Ornament
            id="designer-preview"
            colors={visit.accent ? [visit.accent, ...visit.colors] : visit.colors}
            photoUrl={visit.photoUrl}
            material={visit.material}
            label="Ornament preview"
          />
        </div>
      ) : null}
      {!experiment && (visit.phase === 'open' || visit.phase === 'designing') ? (
        <OrnamentDesigner
          photoUrl={visit.photoUrl}
          colors={visit.colors}
          accent={visit.accent}
          material={visit.material}
          error={visit.error}
          placeholder={!plate && visit.sceneId === JEWELRY_BOX_SCENE.id}
          onPhoto={visit.choosePhoto}
          onMaterial={visit.chooseMaterial}
          onAccent={visit.chooseAccent}
          onFinish={visit.finish}
          onCancel={visit.cancel}
        />
      ) : null}
      {experiment && draft && editedSample ? (
        <CameraExperiment
          editShot={editShot}
          editEnd={editEnd}
          composition={editedSample.composition}
          duration={editedShot?.take.duration ?? 1000}
          dirty={dirty}
          playing={playing}
          playingSequence={runMode === 'sequence'}
          loop={loop}
          status={status}
          limit={limit}
          plate={plate}
          plateError={plateError}
          onEditShot={(index) => beginEdit(index, editEnd)}
          onEditEnd={(end) => beginEdit(editShot, end)}
          onDuration={editDuration}
          onSave={saveFraming}
          onRevert={revertFraming}
          onResetDefault={resetDefault}
          onPreview={() => showSample('shot', editShot)}
          onPlay={() => showSample('sequence', 0)}
          onLoop={setLoop}
          onPlateFile={(file) => void choosePlate(file)}
          onPlateRemove={() => void removePlate()}
        />
      ) : null}
    </div>
  )
}

function stageAnchor(
  camera: RoomCamera,
  sceneId: string | null,
  usingPlate: boolean,
): { x: number; y: number } {
  const point = jewelryStagePoint(usingPlate && sceneId === JEWELRY_BOX_SCENE.id)
  return {
    x: camera.x + point.x * camera.width,
    y: camera.y + point.y * camera.height,
  }
}

function floatingStyle(anchor: { x: number; y: number }): { left: number; top: number } {
  return { left: anchor.x, top: anchor.y }
}

function artworkFor(sceneId: string, box: SceneArtwork): SceneArtwork {
  return sceneId === JEWELRY_BOX_SCENE.id ? box : sceneById(sceneId)
}

function distanceBetween(points: Map<number, { x: number; y: number }>): number {
  const [first, second] = [...points.values()]
  if (!first || !second) return 0
  return Math.hypot(second.x - first.x, second.y - first.y)
}

function centerOf(points: Map<number, { x: number; y: number }>): { x: number; y: number } {
  const values = [...points.values()]
  const count = values.length || 1
  return {
    x: values.reduce((sum, point) => sum + point.x, 0) / count,
    y: values.reduce((sum, point) => sum + point.y, 0) / count,
  }
}
