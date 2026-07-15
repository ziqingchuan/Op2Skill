// ===== Event Types =====

export type EventType =
  | 'click'
  | 'dblclick'
  | 'input'
  | 'change'
  | 'keydown'
  | 'scroll'
  | 'focus'
  | 'blur'
  | 'navigation'
  | 'file_download'
  | 'copy'
  | 'paste'
  | 'drag_start'
  | 'drop'
  | 'frame_blocked'

// ===== DOM Target Info =====

export interface TargetInfo {
  tagName: string
  id?: string
  className?: string
  textContent?: string        // truncated to 100 chars
  placeholder?: string
  ariaLabel?: string
  role?: string
  cssSelector: string
  xpath?: string
  boundingRect?: {
    x: number
    y: number
    width: number
    height: number
  }
  isPassword?: boolean
  inputType?: string
}

// ===== Event Extra Data =====

export interface EventData {
  value?: string
  key?: string
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  scrollX?: number
  scrollY?: number
  scrollDeltaX?: number
  scrollDeltaY?: number
  fromUrl?: string
  toUrl?: string
  filename?: string
  clipboardText?: string
  // merged scroll events count
  mergedCount?: number
}

// ===== Core Event =====

export interface RecordedEvent {
  id: string
  timestamp: number           // Unix ms
  relativeTime: number        // ms since recording started
  type: EventType
  tabId: number
  tabTitle: string
  tabUrl: string
  frameId?: number

  target?: TargetInfo
  data?: EventData

  // Semantic grouping (reserved for compilation layer)
  semanticGroup?: string
  isNoise?: boolean
}

// ===== Session Metadata =====

export interface SessionMeta {
  sessionId: string
  startTime: number
  endTime?: number
  duration?: number           // ms
  browserInfo: {
    name: string
    version: string
    platform: string
  }
  eventCount: number
}

// ===== Full Session Export =====

export interface RecordingSession {
  meta: SessionMeta
  events: RecordedEvent[]
}

// ===== Recording State =====

export type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped'

// ===== Persisted Session Record =====

export interface SessionRecord {
  id: string
  title: string               // user-editable, default "录制 HH:mm:ss"
  createdAt: number           // same as meta.startTime
  meta: SessionMeta
  events: RecordedEvent[]
  skillMarkdown: string
  skillRawOutput: string
}
