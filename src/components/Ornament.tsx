interface OrnamentProps {
  id: string
  colors: string[]
  photoUrl?: string | null
  material?: 'flat' | 'glass' | 'crystal' | 'metal'
  label?: string
  onPress?: () => void
}

/**
 * Draws one flat circular ornament from a color list.
 * The same graphic is used in the preview and on the tree.
 */
export function Ornament({
  id,
  colors,
  photoUrl = null,
  material = 'flat',
  label = 'Ornament',
  onPress,
}: OrnamentProps) {
  const palette = colors.length > 0 ? colors : ['#888888']
  const gradientId = `ornament-fill-${id}`
  const clipId = `ornament-photo-${id}`
  const stops = palette.length === 1 ? [palette[0], palette[0]] : palette
  const capColor = material === 'metal' ? '#e4c27a' : palette[palette.length - 1]
  const rim = material === 'metal' ? '#e4c27a' : material === 'crystal' ? '#f7fbff' : '#f4efe4'
  const veil = material === 'metal' ? 0.28 : material === 'crystal' ? 0.08 : 0.16
  const showPhoto = Boolean(photoUrl) && material !== 'flat'

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
        <clipPath id={clipId}>
          <circle cx="50" cy="66" r="34" />
        </clipPath>
      </defs>
      <circle cx="50" cy="10" r="5" fill={capColor} />
      <rect x="40" y="14" width="20" height="12" rx="2" fill={capColor} />
      {showPhoto ? (
        <image
          href={photoUrl ?? undefined}
          x="16"
          y="32"
          width="68"
          height="68"
          clipPath={`url(#${clipId})`}
          preserveAspectRatio="xMidYMid slice"
        />
      ) : null}
      <circle
        cx="50"
        cy="66"
        r={showPhoto ? 34 : 36}
        fill={showPhoto ? (palette[0] ?? '#ffffff') : `url(#${gradientId})`}
        fillOpacity={showPhoto ? veil : 1}
        stroke={rim}
        strokeWidth="3"
      />
      {showPhoto ? <ellipse cx="38" cy="52" rx="10" ry="6" fill="#fff" fillOpacity="0.35" /> : null}
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
