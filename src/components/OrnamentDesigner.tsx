import { useRef } from 'react'
import type { OrnamentMaterial } from '../types/ornament.ts'

const MATERIALS: { id: Exclude<OrnamentMaterial, 'flat'>; label: string }[] = [
  { id: 'glass', label: '유리' },
  { id: 'crystal', label: '크리스탈' },
  { id: 'metal', label: '메탈' },
]

interface OrnamentDesignerProps {
  photoUrl: string | null
  colors: string[]
  accent: string | null
  material: Exclude<OrnamentMaterial, 'flat'>
  error: string | null
  placeholder: boolean
  onPhoto: (file: File) => void
  onMaterial: (material: Exclude<OrnamentMaterial, 'flat'>) => void
  onAccent: (color: string) => void
  onFinish: () => void
  onCancel: () => void
}

/** Real controls, laid out like the ornament-making reference. Text is not drawn into the art. */
export function OrnamentDesigner({
  photoUrl,
  colors,
  accent,
  material,
  error,
  placeholder,
  onPhoto,
  onMaterial,
  onAccent,
  onFinish,
  onCancel,
}: OrnamentDesignerProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const palette = colors.length > 0 ? colors : []

  return (
    <section className="ornament-atelier" aria-label="장식 만들기">
      <div className="atelier-panel">
        <div className="atelier-tabs" aria-hidden="true">
          <span>색상</span>
          <span className="is-current">재질</span>
        </div>
        <div className="material-orbs" role="group" aria-label="재질">
          {MATERIALS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`material-orb is-${item.id}`}
              aria-pressed={material === item.id}
              onClick={() => onMaterial(item.id)}
            >
              <span className="material-gem" />
              <span className="material-name">{item.label}</span>
            </button>
          ))}
        </div>
        <p className="atelier-label">색상 조정</p>
        <div className="color-dots" role="group" aria-label="이 사진에서 고른 색">
          {palette.map((color, index) => (
            <button
              key={`${color}-${index}`}
              type="button"
              aria-label={color}
              aria-pressed={accent === color}
              style={{ backgroundColor: color }}
              onClick={() => onAccent(color)}
            />
          ))}
        </div>
        {placeholder ? <p className="atelier-note">가까이 보는 장면은 아직 방 사진입니다.</p> : null}
        {error ? (
          <p className="atelier-error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="button" className="glass-pill" onClick={() => fileRef.current?.click()}>
          {photoUrl ? '사진 다시 고르기' : '사진 선택하기'}
        </button>
        <input
          ref={fileRef}
          className="visually-hidden"
          type="file"
          accept="image/jpeg,image/png,image/heic,image/heif,.jpg,.jpeg,.png,.heic,.heif"
          aria-label="장식 사진"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) onPhoto(file)
          }}
        />
      </div>
      <button type="button" className="glass-pill atelier-cancel" onClick={onCancel}>
        다시 선택
      </button>
      <button type="button" className="glass-pill atelier-finish" disabled={!photoUrl} onClick={onFinish}>
        이 장식으로 만들기
      </button>
    </section>
  )
}
