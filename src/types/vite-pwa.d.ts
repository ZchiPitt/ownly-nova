/// <reference types="vite-plugin-pwa/client" />

declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions {
    immediate?: boolean
    onNeedRefresh?: () => void
    onOfflineReady?: () => void
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void
    onRegisterError?: (error: Error) => void
  }

  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>
}

// Custom event type for PWA updates
interface PWAUpdateEvent extends CustomEvent {
  detail: {
    updateSW: (reloadPage?: boolean) => Promise<void>
  }
}

declare global {
  interface WindowEventMap {
    'pwa-update-available': PWAUpdateEvent
  }
}
