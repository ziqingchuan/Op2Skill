// Recording Bridge Service
// Command path: Header -> recordingBridge -> window.electronAPI.setRecordingState -> main -> browser preload
// Event path: browser preload -> main -> window.electronAPI.onBrowserRecorderEvent -> recordingBridge -> store

import type { RecordedEvent } from '@/types/events'

export type BridgeEventCallback = (event: RecordedEvent) => void

interface BridgeOptions {
  onEvent: BridgeEventCallback
}

class RecordingBridge {
  private onEvent: BridgeEventCallback | null = null
  private startTime = 0
  private unsubscribeRecorderEvent: (() => void) | null = null

  connect(options: BridgeOptions): void {
    this.disconnect()
    this.onEvent = options.onEvent

    this.unsubscribeRecorderEvent = window.electronAPI?.onBrowserRecorderEvent((event) => {
      const recordedEvent = event as RecordedEvent
      if (this.startTime) recordedEvent.relativeTime = Date.now() - this.startTime
      this.onEvent?.(recordedEvent)
    }) ?? null
  }

  disconnect(): void {
    this.unsubscribeRecorderEvent?.()
    this.unsubscribeRecorderEvent = null
    this.onEvent = null
  }

  startRecording(startTime: number): void {
    this.startTime = startTime
    window.electronAPI?.setRecordingState('START', startTime).catch(() => {})
  }

  stopRecording(): void {
    window.electronAPI?.setRecordingState('STOP', this.startTime).catch(() => {})
  }

  pauseRecording(): void {
    window.electronAPI?.setRecordingState('PAUSE', this.startTime).catch(() => {})
  }

  resumeRecording(): void {
    window.electronAPI?.setRecordingState('RESUME', this.startTime).catch(() => {})
  }
}

export const recordingBridge = new RecordingBridge()
