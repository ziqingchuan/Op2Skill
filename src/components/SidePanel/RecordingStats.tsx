import { useEventStore } from '@/store/eventStore'
import styles from './RecordingStats.module.css'

export function RecordingStats() {
  const { events, elapsedMs } = useEventStore()

  const eventCount = events.length

  // Count by type groups
  const clickCount = events.filter((e) => e.type === 'click' || e.type === 'dblclick').length
  const inputCount = events.filter((e) => e.type === 'input' || e.type === 'change').length
  const navCount = events.filter((e) => e.type === 'navigation').length
  const keydownCount = events.filter((e) => e.type === 'keydown').length
  const pageHosts = new Set(events.map((e) => {
    try { return new URL(e.tabUrl).hostname }
    catch { return e.tabUrl }
  }).filter(Boolean)).size

  return (
    <div className={styles.grid}>
      <StatItem value={eventCount} label="事件数" accent />
      <StatItem value={formatDuration(elapsedMs)} label="时长" />
      <StatItem value={clickCount} label="点击" />
      <StatItem value={inputCount} label="输入" />
      <StatItem value={navCount} label="导航" />
      <StatItem value={keydownCount} label="键盘" />
      <StatItem value={pageHosts} label="页面" />
    </div>
  )
}

function StatItem({ value, label, accent = false }: { value: string | number; label: string; accent?: boolean }) {
  return (
    <div className={`${styles.item} ${accent ? styles.accent : ''}`}>
      <span className={styles.value}>{value}</span>
      <span className={styles.label}>{label}</span>
    </div>
  )
}

function formatDuration(ms: number): string {
  if (ms < 1000) return '0s'
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m${s % 60}s`
}
