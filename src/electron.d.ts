// Type shims for Electron APIs exposed to the renderer process

import type { RecordedEvent, RecordingSession } from '@/types/events'

type RecorderCommand = 'START' | 'STOP' | 'PAUSE' | 'RESUME'
type ModalType = 'cookie' | 'password' | 'import'

interface ImportedPassword {
  url: string
  username: string
  password: string
}

interface ChromeProfileInfo {
  id: string
  name: string
  path: string
  cookiesPath?: string
  hasCookies: boolean
  hasPasswords: boolean
}

interface ImportOptions {
  profileId?: string
  importCookies?: boolean
  importPasswords?: boolean
  domainFilter?: string
}

interface ImportResult {
  cookiesImported: number
  cookiesSkipped: number
  passwordsImported: number
  passwordsSkipped: number
  errors: string[]
}

declare global {
  interface BrowserBounds {
    x: number
    y: number
    width: number
    height: number
  }

  interface BrowserState {
    url: string
    title: string
    isLoading: boolean
    canGoBack: boolean
    canGoForward: boolean
  }

  interface ElectronAPI {
    isElectron: boolean
    navigateBrowser(url: string): Promise<void>
    browserBack(): Promise<void>
    browserForward(): Promise<void>
    browserReload(): Promise<void>
    browserSetZoom(factor: number): Promise<void>
    browserGetZoom(): Promise<number>
    browserClearCache(): Promise<void>
    browserClearCookies(): Promise<void>
    browserShowContextMenu(): Promise<void>
    setBrowserBounds(bounds: BrowserBounds): Promise<void>
    setRecordingState(cmd: RecorderCommand, startTime?: number): Promise<void>
    generateSkill(session: RecordingSession): Promise<{ normalized: string; raw: string }>
    // Credential management
    browserGetCookies(): Promise<Electron.Cookie[]>
    browserSetCookie(details: Electron.CookiesSetDetails): Promise<void>
    browserRemoveCookie(url: string, name: string): Promise<void>
    browserGetPasswords(): Promise<ImportedPassword[]>
    browserSavePasswords(entries: ImportedPassword[]): Promise<void>
    browserListChromeProfiles(): Promise<ChromeProfileInfo[]>
    browserImportCredentials(options: ImportOptions): Promise<ImportResult>
    browserSetModalVisible(visible: boolean): Promise<void>
    // Sessions persistence
    sessionsLoad(): Promise<string>
    sessionsSave(data: string): Promise<void>
    // Event listeners
    onBrowserStateChange(callback: (state: BrowserState) => void): () => void
    onBrowserRecorderEvent(callback: (event: RecordedEvent) => void): () => void
    onBrowserZoomChange(callback: (factor: number) => void): () => void
    onOpenBrowserModal(callback: (type: ModalType) => void): () => void
  }

  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
