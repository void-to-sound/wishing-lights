import { useEffect, useRef } from 'react'

interface Flake {
  x: number
  y: number
  r: number
  speed: number
  phase: number
  alpha: number
}

interface WindowSnowProps {
  reduced: boolean
}

/**
 * A few slow flakes inside the window only.
 * Reduced motion draws them once and leaves them still.
 */
export function WindowSnow({ reduced }: WindowSnowProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    let flakes: Flake[] = []
    let frame = 0
    let running = true

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.floor(rect.width * dpr))
      canvas.height = Math.max(1, Math.floor(rect.height * dpr))
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (flakes.length === 0) flakes = Array.from({ length: 36 }, () => makeFlake(rect.width, rect.height, true))
    }

    const paint = (time: number) => {
      const rect = canvas.getBoundingClientRect()
      context.clearRect(0, 0, rect.width, rect.height)
      for (const flake of flakes) {
        if (!reduced) {
          flake.y += flake.speed
          flake.x += Math.sin(time / 1400 + flake.phase) * 0.12
          if (flake.y > rect.height + 4) {
            const next = makeFlake(rect.width, rect.height, false)
            flake.x = next.x
            flake.y = -4
            flake.r = next.r
            flake.speed = next.speed
            flake.alpha = next.alpha
          }
        }
        context.globalAlpha = flake.alpha
        context.fillStyle = '#f7fbff'
        context.beginPath()
        context.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2)
        context.fill()
      }
      context.globalAlpha = 1
    }

    const loop = (time: number) => {
      if (!running) return
      paint(time)
      if (!reduced && document.visibilityState !== 'hidden') {
        frame = requestAnimationFrame(loop)
      }
    }

    resize()
    const observer = new ResizeObserver(() => {
      resize()
      paint(performance.now())
    })
    observer.observe(canvas)
    frame = requestAnimationFrame(loop)

    return () => {
      running = false
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [reduced])

  return <canvas ref={canvasRef} className="snow" />
}

function makeFlake(width: number, height: number, anywhere: boolean): Flake {
  return {
    x: Math.random() * width,
    y: anywhere ? Math.random() * height : -4,
    r: 0.6 + Math.random() * 1.5,
    speed: 0.15 + Math.random() * 0.35,
    phase: Math.random() * Math.PI * 2,
    alpha: 0.35 + Math.random() * 0.5,
  }
}
