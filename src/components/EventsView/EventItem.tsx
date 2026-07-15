import { useCallback } from 'react'
import type { RecordedEvent } from '@/types/events'
import { Badge } from '@/components/common/Badge'
import { JsonViewer } from '@/components/common/JsonViewer'
import { useUIStore } from '@/store/uiStore'
import styles from './EventItem.module.css'

interface EventItemProps {
  event: RecordedEvent
  index: number
}

export function EventItem({ event, index }: EventItemProps) {
  const { expandedEventIds, toggleEventExpanded } = useUIStore()
  const isExpanded = expandedEventIds.has(event.id)
  const toggle = useCallback(() => toggleEventExpanded(event.id), [event.id, toggleEventExpanded])

  return (
    <div className={styles.item}>
      <div className={styles.main} onClick={toggle} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggle() }}>
        <span className={styles.index}>{index + 1}</span>
        <Badge type={event.type} />
        <div className={styles.summary}>
          <span className={styles.target}>{getTargetSummary(event)}</span>
          {event.data?.value && (
            <span className={styles.value}>&ldquo;{String(event.data.value).slice(0, 40)}&rdquo;</span>
          )}

        </div>
        <div className={styles.meta}>
          <span className={styles.tabTitle}>{event.tabTitle.slice(0, 20)}</span>
          <span className={styles.time}>{formatTime(event.relativeTime)}</span>
          <span className={styles.chevron}>{isExpanded ? '▾' : '▸'}</span>
        </div>
      </div>

      {isExpanded && (
        <div className={styles.detail}>
          <JsonViewer data={event} maxHeight="320px" />
        </div>
      )}
    </div>
  )
}

function getTargetSummary(e: RecordedEvent): string {
  if (!e.target) return e.type
  const tag = e.target.tagName?.toLowerCase() ?? ''
  const label = e.target.ariaLabel || e.target.placeholder || e.target.textContent || ''
  if (label) return `${tag} · "${label.slice(0, 40)}"`
  if (e.target.id) return `${tag}#${e.target.id}`
  return e.target.cssSelector?.slice(0, 50) ?? tag
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = (ms / 1000).toFixed(1)
  return `${s}s`
}
