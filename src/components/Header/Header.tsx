import { useEffect } from 'react'
import { useEventStore } from '@/store/eventStore'
import { useSessionStore } from '@/store/sessionStore'
import { recordingBridge } from '@/services/recordingBridge'
import { Button } from '@/components/common/Button'
import styles from './Header.module.css'

export function Header() {
  const { recordingState, elapsedMs, stopRecording, pauseRecording, resumeRecording, addEvent, events, meta } = useEventStore()
  const { createSession, updateSession, activeSessionId } = useSessionStore()

  useEffect(() => {
    recordingBridge.connect({
      onEvent: (event) => addEvent(event),
    })
    return () => recordingBridge.disconnect()
  }, [addEvent])

  const handleStartClick = () => {
    const id = createSession()
    const startTime = Date.now()
    useEventStore.getState().startRecording(id, startTime)
    recordingBridge.startRecording(startTime)
  }

  const handleStop = () => {
    stopRecording()
    recordingBridge.stopRecording()
    // Flush current events + meta into the persisted session record
    const { events: currentEvents, meta: currentMeta } = useEventStore.getState()
    if (activeSessionId && currentMeta) {
      updateSession(activeSessionId, { events: currentEvents, meta: currentMeta })
    }
  }

  const handlePause = () => {
    pauseRecording()
    recordingBridge.pauseRecording()
    // Flush partial progress
    const { events: currentEvents, meta: currentMeta } = useEventStore.getState()
    if (activeSessionId && currentMeta) {
      updateSession(activeSessionId, { events: currentEvents, meta: currentMeta })
    }
  }

  const handleResume = () => {
    resumeRecording()
    recordingBridge.resumeRecording()
  }

  const isRecording = recordingState === 'recording'
  const isPaused = recordingState === 'paused'
  const isStopped = recordingState === 'stopped' || recordingState === 'idle'

  return (
    <header className={styles.header}>
      <div className={styles.trafficSpacer} aria-hidden="true" />

      <div className={styles.statusArea}>
        {isStopped && <span className={styles.idleStatus}>准备录制</span>}
        {isRecording && (
          <div className={styles.recordingIndicator}>
            <span className={styles.recordingDot} aria-label="录制中" />
            <span className={styles.recordingLabel}>录制中</span>
            <span className={styles.timer}>{formatElapsed(elapsedMs)}</span>
          </div>
        )}
        {isPaused && (
          <div className={`${styles.recordingIndicator} ${styles.paused}`}>
            <span className={styles.pausedIcon}>⏸</span>
            <span className={styles.recordingLabel}>已暂停</span>
            <span className={styles.timer}>{formatElapsed(elapsedMs)}</span>
          </div>
        )}
      </div>

      <div className={styles.controls}>
        {isStopped && (
          <Button variant="primary" size="sm" onClick={handleStartClick} icon="●">
            开始录制
          </Button>
        )}
        {isRecording && (
          <>
            <Button variant="ghost" size="sm" onClick={handlePause} icon="⏸">暂停</Button>
            <Button variant="danger" size="sm" onClick={handleStop} icon="⏹">停止</Button>
          </>
        )}
        {isPaused && (
          <>
            <Button variant="success" size="sm" onClick={handleResume} icon="▶">继续</Button>
            <Button variant="danger" size="sm" onClick={handleStop} icon="⏹">停止</Button>
          </>
        )}
      </div>
    </header>
  )
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}:${pad(m % 60)}:${pad(s % 60)}`
  return `${pad(m)}:${pad(s % 60)}`
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
