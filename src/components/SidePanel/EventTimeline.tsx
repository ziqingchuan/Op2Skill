import { useMemo } from 'react'
import { useEventStore } from '@/store/eventStore'
import { useActiveSession } from '@/store/sessionStore'
import styles from './EventTimeline.module.css'

const BUCKET_COUNT = 30

export function EventTimeline() {
  const activeSession = useActiveSession()
  const { recordingState, events: liveEvents, elapsedMs } = useEventStore()

  const events = recordingState === 'recording' || recordingState === 'paused'
    ? liveEvents
    : (activeSession?.events ?? [])
  const totalMs = recordingState === 'recording' || recordingState === 'paused'
    ? elapsedMs
    : (activeSession?.meta?.duration ?? elapsedMs)

  const buckets = useMemo(() => {
    if (events.length === 0) return []
    const effectiveMs = Math.max(totalMs, events[events.length - 1]?.relativeTime ?? 1000)
    const bucketSize = effectiveMs / BUCKET_COUNT
    const counts = new Array<number>(BUCKET_COUNT).fill(0)
    for (const e of events) {
      const idx = Math.min(Math.floor(e.relativeTime / bucketSize), BUCKET_COUNT - 1)
      counts[idx]++
    }
    return counts
  }, [events, totalMs])

  const maxCount = Math.max(...buckets, 1)

  if (events.length === 0) {
    return <div className={styles.empty}>时间轴将在此显示</div>
  }

  return (
    <div className={styles.timeline} role="img" aria-label="事件密度时间轴">
      {buckets.map((count, i) => (
        <div
          key={i}
          className={styles.bar}
          style={{ height: `${Math.max((count / maxCount) * 100, count > 0 ? 10 : 2)}%` }}
          title={`${count} 个事件`}
        />
      ))}
    </div>
  )
}
