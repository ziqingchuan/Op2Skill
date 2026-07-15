import { useEventStore } from '@/store/eventStore'
import styles from './SessionInfo.module.css'

export function SessionInfo() {
  const { meta, recordingState } = useEventStore()

  if (!meta) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}>⊙</span>
        <p>暂无活跃会话</p>
      </div>
    )
  }

  return (
    <div className={styles.card}>
      <div className={styles.row}>
        <span className={styles.label}>会话 ID</span>
        <span className={styles.mono}>{meta.sessionId.slice(0, 8)}…</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>状态</span>
        <span className={`${styles.status} ${styles[recordingState]}`}>
          {recordingState === 'idle' ? '空闲'
            : recordingState === 'recording' ? '录制中'
            : recordingState === 'paused' ? '已暂停'
            : '已停止'}
        </span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>开始时间</span>
        <span className={styles.value}>{new Date(meta.startTime).toLocaleTimeString('zh-CN')}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>浏览器</span>
        <span className={styles.value}>{meta.browserInfo.name} {meta.browserInfo.version}</span>
      </div>
    </div>
  )
}
