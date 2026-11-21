import curious from '../assets/poses/curious.png'
import rest from '../assets/poses/rest.png'
import sleep from '../assets/poses/sleep.png'
import sniff from '../assets/poses/sniff.png'
import stand from '../assets/poses/stand.png'
import turn from '../assets/poses/turn.png'
import wake from '../assets/poses/wake.png'
import walkA from '../assets/poses/walk-a.png'
import walkB from '../assets/poses/walk-b.png'
import yawn from '../assets/poses/yawn.png'
import type { Pose } from './behavior.ts'

export const POSE_SRC: Record<Pose, string> = {
  sleep,
  yawn,
  wake,
  curious,
  rest,
  turn,
  stand,
  sniff,
  walkA,
  walkB,
}

/** Standing frames are taller in the crop, so they are scaled down to the lying body. */
export const POSE_SCALE: Record<Pose, number> = {
  sleep: 1,
  yawn: 1,
  rest: 1,
  wake: 0.98,
  curious: 0.98,
  walkA: 0.94,
  walkB: 0.94,
  sniff: 0.9,
  stand: 0.8,
  turn: 0.76,
}

export function isLowPose(pose: Pose): boolean {
  return pose === 'sleep' || pose === 'yawn' || pose === 'rest' || pose === 'wake' || pose === 'curious'
}
