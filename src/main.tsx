import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

// Register service worker on app load
// Using registerType: 'prompt' allows manual control of updates
const updateSW = registerSW({
  onNeedRefresh() {
    // Dispatch custom event for app update UI (handled in US-090)
    window.dispatchEvent(new CustomEvent('pwa-update-available', {
      detail: { updateSW }
    }))
  },
  onOfflineReady() {
    console.log('App ready for offline use')
  },
  onRegistered(registration) {
    console.log('Service worker registered:', registration)
  },
  onRegisterError(error) {
    console.error('Service worker registration error:', error)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
