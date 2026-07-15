import { useMemo, useRef, useEffect } from 'react'
import { useEventStore } from '@/store/eventStore'
import { useActiveSession } from '@/store/sessionStore'
import { useUIStore } from '@/store/uiStore'
import { EventItem } from './EventItem'
import { FilterBar } from './FilterBar'
import styles from './EventList.module.css'

export function EventList() {
  const activeSession = useActiveSession()
  const { recordingState, events: liveEvents } = useEventStore()
  // During active recording show live events; otherwise show the persisted session's events
  const events = recordingState === 'recording' || recordingState === 'paused'
    ? liveEvents
    : (activeSession?.events ?? [])
  const { filter } = useUIStore()
  const bottomRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom during recording
  useEffect(() => {
    if (recordingState === 'recording' && isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [events.length, recordingState])

  const handleScroll = () => {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 60
  }

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (filter.types.length > 0 && !filter.types.includes(e.type)) return false
      if (filter.searchQuery) {
        const q = filter.searchQuery.toLowerCase()
        const searchable = [
          e.type,
          e.tabTitle,
          e.tabUrl,
          e.target?.tagName,
          e.target?.textContent,
          e.target?.ariaLabel,
          e.target?.placeholder,
          e.target?.cssSelector,
          e.data?.value,
          e.data?.key,
        ].filter(Boolean).join(' ').toLowerCase()
        if (!searchable.includes(q)) return false
      }
      return true
    })
  }, [events, filter])

  if (events.length === 0) {
    return (
      <div className={styles.wrap}>
        <FilterBar />
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>○</div>
          <p className={styles.emptyTitle}>暂无录制事件</p>
          <p className={styles.emptyHint}>点击「开始录制」后在浏览器中进行操作，事件将实时出现在这里。</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <FilterBar />
      <div className={styles.listHeader}>
        <span>{filteredEvents.length} / {events.length} 个事件</span>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          {filter.types.length > 0 && <span className={styles.filterNote}>类型已筛选</span>}
        </div>
      </div>
      <div className={styles.list} ref={containerRef} onScroll={handleScroll}>
        {filteredEvents.map((event) => (
          <div key={event.id}>
            <EventItem event={event} index={events.indexOf(event)} />
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
