/// <reference types="vite/client" />

declare global {
  interface Window {
    utools?: {
      onPluginEnter?: (callback: (action: { code: string; type?: string; payload?: unknown }) => void) => void
      onPluginOut?: (callback: (isKill: boolean) => void) => void
      copyText?: (text: string) => boolean
      copyImage?: (img: string) => boolean
      pasteText?: (text: string) => boolean
      showNotification?: (body: string) => void
      hideMainWindow?: () => void
      showMainWindow?: () => void
      isDev?: () => boolean
    }
    preload?: {
      db?: {
        get?: (id: string) => any
        put?: (doc: any) => any
        remove?: (id: string) => any
        allDocs?: (prefix: string) => Array<{ doc: any }>
      }
      hideMainWindow?: () => void
      showMainWindow?: () => void
      hideMainWindowPasteText?: (text: string) => boolean
      isWindows?: () => boolean
      isMacOS?: () => boolean
      isDev?: () => boolean
      notify?: (text: string) => void
    }
  }
}

export {}
