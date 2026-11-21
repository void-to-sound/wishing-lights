import { useEffect, useState, type RefObject } from 'react'
import { fadeBetween, placement, type Frame, type Pose } from './behavior.ts'
import { POSE_SCALE, POSE_SRC, isLowPose } from './poses.ts'

interface DogProps {
  frame: Frame
  pose: Pose
  breath: boolean
  twitchId: number
  snoreId: number
  onActivate: () => void
  dogRef: RefObject<HTMLButtonElement | null>
}

export function Dog({ frame, pose, breath, twitchId, snoreId, onActivate, dogRef }: DogProps) {
  const targetX = frame.walk ? (frame.xTo ?? frame.x) : frame.x
  const targetMs = frame.walk && Math.abs(targetX - frame.x) > 0.2 ? frame.ms : 700
  const [motion, setMotion] = useState({ x: frame.x, ms: 0, serial: frame.serial })
  if (motion.serial !== frame.serial) {
    setMotion({ x: targetX, ms: targetMs, serial: frame.serial })
  }

  const [current, setCurrent] = useState(pose)
  const [previous, setPrevious] = useState<Pose | null>(null)
  const [fadeMs, setFadeMs] = useState(480)
  if (pose !== current) {
    setFadeMs(fadeBetween(current, pose))
    setPrevious(current)
    setCurrent(pose)
  }

  const [twitchOn, setTwitchOn] = useState(false)
  const [snoreOn, setSnoreOn] = useState(false)

  useEffect(() => {
    if (previous === null) return
    const from = previous
    const timeout = window.setTimeout(() => {
      setPrevious((value) => (value === from ? null : value))
    }, fadeMs + 40)
    return () => window.clearTimeout(timeout)
  }, [current, previous, fadeMs])

  useEffect(() => {
    if (twitchId === 0) return
    const on = window.setTimeout(() => setTwitchOn(true), 20)
    const off = window.setTimeout(() => setTwitchOn(false), 540)
    return () => {
      window.clearTimeout(on)
      window.clearTimeout(off)
    }
  }, [twitchId])

  useEffect(() => {
    if (snoreId === 0) return
    const on = window.setTimeout(() => setSnoreOn(true), 20)
    const off = window.setTimeout(() => setSnoreOn(false), 1320)
    return () => {
      window.clearTimeout(on)
      window.clearTimeout(off)
    }
  }, [snoreId])

  const place = placement(motion.x)
  const low = isLowPose(pose)

  return (
    <div
      className="dog-anchor"
      style={{
        left: `${motion.x}%`,
        bottom: `${place.bottom}%`,
        transform: `translateX(-50%) scale(${place.depth})`,
        transitionDuration: `${motion.ms}ms`,
      }}
    >
      <div className={low ? 'shadow low' : 'shadow'} />
      <div className="flip" style={{ transform: `scaleX(${frame.flip})` }}>
        <div
          className={[
            'body',
            breath ? 'breathing' : '',
            frame.walk ? 'walking' : '',
            pose === 'sniff' ? 'sniffing' : '',
            twitchOn ? 'twitch' : '',
            snoreOn ? 'snoring' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {previous ? (
            <img
              className="sprite out"
              alt=""
              src={POSE_SRC[previous]}
              draggable={false}
              style={{ animationDuration: `${fadeMs}ms`, transform: `scale(${POSE_SCALE[previous]})` }}
            />
          ) : null}
          <img
            key={current}
            className="sprite in"
            alt=""
            src={POSE_SRC[current]}
            draggable={false}
            style={{ animationDuration: `${fadeMs}ms`, transform: `scale(${POSE_SCALE[current]})` }}
          />
        </div>
      </div>
      <button
        ref={dogRef}
        type="button"
        className="hit"
        aria-label="The dog"
        onClick={(event) => {
          event.stopPropagation()
          onActivate()
        }}
      />
    </div>
  )
}
