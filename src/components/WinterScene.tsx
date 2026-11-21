import {
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import {
  ROOM_SRC,
  TREE_FOCUS_X,
  clampLook,
  frameRoom,
} from '../lib/roomCamera.ts'

interface WinterSceneProps {
  children: ReactNode
}

const DRAG_THRESHOLD = 10

/**
 * The photograph is the coordinate space for every object in the room.
 * The camera moves that whole space with one transform, so the tree,
 * ornaments, and anything added later stay locked to the picture.
 * Effects stay on their own layer so snow, fire, or light can be added later.
 */
export function WinterScene({ children }: WinterSceneProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const [lookX, setLookX] = useState(TREE_FOCUS_X)
  const [dragging, setDragging] = useState(false)
  const drag = useRef({
    pointer: -1,
    startX: 0,
    startLook: TREE_FOCUS_X,
    moved: false,
  })
  const suppressClick = useRef(false)

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

  const camera = frameRoom(viewport.width, viewport.height, lookX)

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
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
    if (event.pointerId !== drag.current.pointer || camera.width <= 0) return
    const distance = event.clientX - drag.current.startX
    if (!drag.current.moved && Math.abs(distance) < DRAG_THRESHOLD) return
    drag.current.moved = true
    setDragging(true)
    setLookX(clampLook(viewport.width, camera.width, drag.current.startLook - distance / camera.width))
  }

  function finishPointer(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerId !== drag.current.pointer) return
    if (drag.current.moved) suppressClick.current = true
    drag.current.pointer = -1
    setDragging(false)
  }

  function onClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (!suppressClick.current) return
    event.preventDefault()
    event.stopPropagation()
    suppressClick.current = false
  }

  const exploring = camera.explore
  const frameClass = [
    'scene-frame',
    exploring ? 'is-exploring' : '',
    dragging ? 'is-dragging' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      ref={frameRef}
      className={frameClass}
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
        <img className="scene-background" src={ROOM_SRC} alt="" draggable={false} />
        <div className="scene-effects" />
        <div className="scene-objects">{children}</div>
      </div>
    </div>
  )
}
