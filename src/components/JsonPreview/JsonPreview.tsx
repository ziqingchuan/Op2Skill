import { useActiveSession } from '@/store/sessionStore'
import { JsonViewer } from '@/components/common/JsonViewer'
import styles from './JsonPreview.module.css'

export function JsonPreview() {
  const activeSession = useActiveSession()
  const events = activeSession?.events ?? []
  const meta = activeSession?.meta ?? null

  const sessionData = meta ? { meta, events } : null

  if (!sessionData) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>{ }</div>
        <p className={styles.emptyTitle}>暂无会话数据</p>
        <p className={styles.emptyHint}>录制一次会话后，完整的 events.json 将在此展示。</p>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <span className={styles.filename}>events.json</span>
          <span className={styles.count}>{events.length} 个事件</span>
        </div>
      </div>
      <div className={styles.viewer}>
        <JsonViewer data={sessionData} initialCollapsed={false} maxHeight="100%" />
      </div>
    </div>
  )
}
