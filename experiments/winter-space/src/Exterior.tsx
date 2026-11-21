/** Soft winter woods seen through the glass. Static. Snow is a separate layer. */
export function Exterior() {
  return (
    <svg className="exterior" viewBox="0 0 544 436" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="winter-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c5d0dc" />
          <stop offset="0.55" stopColor="#b3c0cd" />
          <stop offset="1" stopColor="#a7b6c4" />
        </linearGradient>
        <linearGradient id="winter-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e7eef2" />
          <stop offset="1" stopColor="#d5dee6" />
        </linearGradient>
      </defs>
      <rect width="544" height="436" fill="url(#winter-sky)" />
      <g fill="#8b98a6" opacity="0.28">
        <rect x="46" y="168" width="3" height="92" />
        <rect x="78" y="150" width="2" height="110" />
        <rect x="124" y="176" width="3" height="84" />
        <rect x="188" y="142" width="2" height="118" />
        <rect x="230" y="160" width="3" height="100" />
        <rect x="286" y="136" width="2" height="124" />
        <rect x="340" y="158" width="3" height="102" />
        <rect x="392" y="148" width="2" height="112" />
        <rect x="454" y="170" width="3" height="90" />
        <rect x="498" y="156" width="2" height="104" />
      </g>
      <rect y="150" width="544" height="90" fill="#e7eef3" opacity="0.35" />
      <rect y="248" width="544" height="188" fill="url(#winter-ground)" />
      <rect y="248" width="544" height="28" fill="#f7fafb" opacity="0.7" />
    </svg>
  )
}
