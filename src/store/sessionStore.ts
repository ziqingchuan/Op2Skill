import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { SessionRecord, SessionMeta, RecordedEvent } from '@/types/events'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(ts: number): string {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `录制 ${hh}:${mm}:${ss}`
}

async function saveToDisk(sessions: SessionRecord[]): Promise<void> {
  try {
    const data = JSON.stringify(sessions)
    await window.electronAPI?.sessionsSave(data)
  } catch { /* ignore in non-Electron environments */ }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface SessionStoreState {
  sessions: SessionRecord[]
  activeSessionId: string | null

  // Actions
  loadSessions(): Promise<void>
  createSession(): string
  updateSession(id: string, patch: Partial<Pick<SessionRecord, 'meta' | 'events' | 'skillMarkdown' | 'skillRawOutput'>>): void
  renameSession(id: string, title: string): void
  deleteSession(id: string): void
  setActiveSession(id: string): void
}

export const useSessionStore = create<SessionStoreState>((set, get) => ({
  sessions: [],
  activeSessionId: null,

  async loadSessions() {
    try {
      const raw = await window.electronAPI?.sessionsLoad()
      if (!raw) return
      const parsed = JSON.parse(raw) as SessionRecord[]
      if (!Array.isArray(parsed)) return
      const lastId = parsed.length > 0 ? parsed[parsed.length - 1].id : null
      set({ sessions: parsed, activeSessionId: lastId })
    } catch {
      set({ sessions: [], activeSessionId: null })
    }
  },

  createSession() {
    const id = uuidv4()
    const createdAt = Date.now()
    const record: SessionRecord = {
      id,
      title: formatTime(createdAt),
      createdAt,
      meta: {
        sessionId: id,
        startTime: createdAt,
        browserInfo: { name: '', version: '', platform: '' },
        eventCount: 0,
      },
      events: [],
      skillMarkdown: '',
      skillRawOutput: '',
    }
    const sessions = [...get().sessions, record]
    set({ sessions, activeSessionId: id })
    saveToDisk(sessions)
    return id
  },

  updateSession(id, patch) {
    const sessions = get().sessions.map((s) =>
      s.id === id ? { ...s, ...patch } : s
    )
    set({ sessions })
    saveToDisk(sessions)
  },

  renameSession(id, title) {
    const sessions = get().sessions.map((s) =>
      s.id === id ? { ...s, title } : s
    )
    set({ sessions })
    saveToDisk(sessions)
  },

  deleteSession(id) {
    const { sessions, activeSessionId } = get()
    const idx = sessions.findIndex((s) => s.id === id)
    const next = sessions.filter((s) => s.id !== id)
    let nextActiveId: string | null = activeSessionId
    if (activeSessionId === id) {
      if (next.length > 0) {
        nextActiveId = next[Math.min(idx, next.length - 1)].id
      } else {
        nextActiveId = null
      }
    }
    set({ sessions: next, activeSessionId: nextActiveId })
    saveToDisk(next)
  },

  setActiveSession(id) {
    set({ activeSessionId: id })
  },
}))

// Reactive selector — use inside React components for proper re-renders
export function useActiveSession(): SessionRecord | null {
  return useSessionStore((s) => s.sessions.find((r) => r.id === s.activeSessionId) ?? null)
}

// Non-reactive helper for use outside components (callbacks, effects, etc.)
export function getActiveSession(): SessionRecord | null {
  const { sessions, activeSessionId } = useSessionStore.getState()
  return sessions.find((s) => s.id === activeSessionId) ?? null
}
