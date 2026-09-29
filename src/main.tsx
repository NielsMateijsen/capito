import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted, so the font works offline in the PWA (precached with the app shell)
// Latin only: Dutch and Italian need no other character sets
import '@fontsource/figtree/latin-400.css'
import '@fontsource/figtree/latin-500.css'
import '@fontsource/figtree/latin-600.css'
import '@fontsource/figtree/latin-700.css'
import '@fontsource/figtree/latin-800.css'
import './ui/theme.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
