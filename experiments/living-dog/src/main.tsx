import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LivingDog } from './LivingDog.tsx'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LivingDog />
  </StrictMode>,
)
