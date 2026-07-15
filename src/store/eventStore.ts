import { create } from 'zustand'
import type { RecordedEvent, SessionMeta, RecordingState } from '@/types/events'

interface EventStoreState {
  events: RecordedEvent[]
  meta: SessionMeta | null
  recordingState: RecordingState
  elapsedMs: number
  _timerRef: ReturnType<typeof setInterval> | null

  // Actions
  startRecording: (sessionId: string, startTime: number) => void
  stopRecording: () => void
  pauseRecording: () => void
  resumeRecording: () => void
  addEvent: (event: RecordedEvent) => void
  resetForNewSession: () => void
}

function getBrowserInfo() {
  const ua = navigator.userAgent
  let name = 'Unknown'
  let version = 'Unknown'
  if (ua.includes('Chrome')) {
    name = 'Chrome'
    const match = ua.match(/Chrome\/([\d.]+)/)
    version = match ? match[1] : 'Unknown'
  } else if (ua.includes('Firefox')) {
    name = 'Firefox'
    const match = ua.match(/Firefox\/([\d.]+)/)
    version = match ? match[1] : 'Unknown'
  } else if (ua.includes('Safari')) {
    name = 'Safari'
    const match = ua.match(/Version\/([\d.]+)/)
    version = match ? match[1] : 'Unknown'
  }
  return { name, version, platform: navigator.platform }
}

export const useEventStore = create<EventStoreState>((set, get) => ({
  events: [],
  meta: null,
  recordingState: 'idle',
  elapsedMs: 0,
  _timerRef: null,

  startRecording: (sessionId: string, startTime: number) => {
    const meta: SessionMeta = {
      sessionId,
      startTime,
      browserInfo: getBrowserInfo(),
      eventCount: 0,
    }

    const timerRef = setInterval(() => {
      set((s) => ({ elapsedMs: Date.now() - (s.meta?.startTime ?? Date.now()) }))
    }, 1000)

    set({
      events: [],
      meta,
      recordingState: 'recording',
      elapsedMs: 0,
      _timerRef: timerRef,
    })
  },

  stopRecording: () => {
    const { _timerRef, events } = get()
    if (_timerRef) clearInterval(_timerRef)
    const endTime = Date.now()
    set((s) => ({
      recordingState: 'stopped',
      _timerRef: null,
      meta: s.meta
        ? {
            ...s.meta,
            endTime,
            duration: endTime - s.meta.startTime,
            eventCount: events.length,
          }
        : null,
    }))
  },

  pauseRecording: () => {
    const { _timerRef } = get()
    if (_timerRef) clearInterval(_timerRef)
    set({ recordingState: 'paused', _timerRef: null })
  },

  resumeRecording: () => {
    const { meta } = get()
    if (!meta) return
    const timerRef = setInterval(() => {
      set((s) => ({ elapsedMs: Date.now() - (s.meta?.startTime ?? Date.now()) }))
    }, 1000)
    set({ recordingState: 'recording', _timerRef: timerRef })
  },

  addEvent: (event: RecordedEvent) => {
    set((s) => {
      const events = [...s.events, event]
      return {
        events,
        meta: s.meta ? { ...s.meta, eventCount: events.length } : null,
      }
    })
  },

  resetForNewSession: () => {
    const { _timerRef } = get()
    if (_timerRef) clearInterval(_timerRef)
    set({
      events: [],
      meta: null,
      recordingState: 'idle',
      elapsedMs: 0,
      _timerRef: null,
    })
  },
}))
