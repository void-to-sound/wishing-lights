interface OrnamentProps {
  id: string
  colors: string[]
  label?: string
  onPress?: () => void
}

/**
 * Draws one flat circular ornament from a color list.
 * The same graphic is used in the preview and on the tree.
 */
export function Ornament({ id, colors, label = 'Ornament', onPress }: OrnamentProps) {
  const palette = colors.length > 0 ? colors : ['#888888']
  const gradientId = `ornament-fill-${id}`
  const stops = palette.length === 1 ? [palette[0], palette[0]] : palette
  const capColor = palette[palette.length - 1]

  const graphic = (
    <svg viewBox="0 0 100 116" role="img" aria-label={label}>
      <title>{label}</title>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          {stops.map((color, index) => (
            <stop
              key={`${color}-${index}`}
              offset={`${(index / (stops.length - 1)) * 100}%`}
              stopColor={color}
            />
          ))}
        </linearGradient>
      </defs>
      <circle cx="50" cy="10" r="5" fill={capColor} />
      <rect x="40" y="14" width="20" height="12" rx="2" fill={capColor} />
      <circle
        cx="50"
        cy="66"
        r="36"
        fill={`url(#${gradientId})`}
        stroke="#f4efe4"
        strokeWidth="3"
      />
    </svg>
  )

  if (!onPress) {
    return <div className="ornament">{graphic}</div>
  }

  return (
    <button
      type="button"
      className="ornament ornament-button"
      onClick={(event) => {
        event.stopPropagation()
        onPress()
      }}
    >
      {graphic}
    </button>
  )
}
