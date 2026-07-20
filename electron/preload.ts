import { contextBridge, ipcRenderer } from 'electron'

interface BrowserBounds {
  x: number
  y: number
  width: number
  height: number
}

type RecorderCommand = 'START' | 'STOP' | 'PAUSE' | 'RESUME'

type BrowserState = {
  url: string
  title: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
}

interface RecordingSessionPayload {
  meta: unknown
  events: unknown[]
}

interface ImportedCookie {
  url: string
  name: string
  value: string
  domain: string
  path: string
  secure: boolean
  httpOnly: boolean
  expirationDate?: number
}

interface ImportedPassword {
  url: string
  username: string
  password: string
}

type ModalType = 'cookie' | 'password' | 'import'

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

type Unsubscribe = () => void

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  navigateBrowser(url: string) {
    return ipcRenderer.invoke('browser:navigate', url)
  },

  browserBack() {
    return ipcRenderer.invoke('browser:back')
  },

  browserForward() {
    return ipcRenderer.invoke('browser:forward')
  },

  browserReload() {
    return ipcRenderer.invoke('browser:reload')
  },

  browserSetZoom(factor: number) {
    return ipcRenderer.invoke('browser:set-zoom', factor)
  },

  browserGetZoom() {
    return ipcRenderer.invoke('browser:get-zoom')
  },

  browserClearCache() {
    return ipcRenderer.invoke('browser:clear-cache')
  },

  browserClearCookies() {
    return ipcRenderer.invoke('browser:clear-cookies')
  },

  browserShowContextMenu() {
    return ipcRenderer.invoke('browser:show-context-menu')
  },

  setBrowserBounds(bounds: BrowserBounds) {
    return ipcRenderer.invoke('browser:set-bounds', bounds)
  },

  setRecordingState(cmd: RecorderCommand, startTime = 0) {
    return ipcRenderer.invoke('browser:set-recording-state', { cmd, startTime })
  },

  generateSkill(session: RecordingSessionPayload) {
    return ipcRenderer.invoke('skill:generate', session)
  },

  // Credential management
  browserGetCookies() {
    return ipcRenderer.invoke('browser:get-cookies') as Promise<Electron.Cookie[]>
  },

  browserSetCookie(details: Electron.CookiesSetDetails) {
    return ipcRenderer.invoke('browser:set-cookie', details)
  },

  browserRemoveCookie(url: string, name: string) {
    return ipcRenderer.invoke('browser:remove-cookie', url, name)
  },

  browserGetPasswords() {
    return ipcRenderer.invoke('browser:get-passwords') as Promise<ImportedPassword[]>
  },

  browserSavePasswords(entries: ImportedPassword[]) {
    return ipcRenderer.invoke('browser:save-passwords', entries)
  },

  browserListChromeProfiles() {
    return ipcRenderer.invoke('browser:list-chrome-profiles') as Promise<ChromeProfileInfo[]>
  },

  browserImportCredentials(options: ImportOptions) {
    return ipcRenderer.invoke('browser:import-credentials', options) as Promise<ImportResult>
  },

  browserSetModalVisible(visible: boolean) {
    return ipcRenderer.invoke('browser:set-modal-visible', visible)
  },

  sessionsLoad() {
    return ipcRenderer.invoke('sessions:load') as Promise<string>
  },

  sessionsSave(data: string) {
    return ipcRenderer.invoke('sessions:save', data)
  },

  // Event listeners
  onBrowserStateChange(callback: (state: BrowserState) => void): Unsubscribe {
    const listener = (_event: Electron.IpcRendererEvent, state: BrowserState) => callback(state)
    ipcRenderer.on('browser-state-change', listener)
    return () => ipcRenderer.removeListener('browser-state-change', listener)
  },

  onBrowserRecorderEvent(callback: (event: unknown) => void): Unsubscribe {
    const listener = (_event: Electron.IpcRendererEvent, recordedEvent: unknown) => callback(recordedEvent)
    ipcRenderer.on('browser-recorder-event', listener)
    return () => ipcRenderer.removeListener('browser-recorder-event', listener)
  },

  onBrowserZoomChange(callback: (factor: number) => void): Unsubscribe {
    const listener = (_event: Electron.IpcRendererEvent, factor: number) => callback(factor)
    ipcRenderer.on('browser-zoom-change', listener)
    return () => ipcRenderer.removeListener('browser-zoom-change', listener)
  },

  onOpenBrowserModal(callback: (type: ModalType) => void): Unsubscribe {
    const listener = (_event: Electron.IpcRendererEvent, type: ModalType) => callback(type)
    ipcRenderer.on('open-browser-modal', listener)
    return () => ipcRenderer.removeListener('open-browser-modal', listener)
  },
})
