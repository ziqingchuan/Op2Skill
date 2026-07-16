import { SessionInfo } from './SessionInfo'
import { SessionList } from './SessionList'
import { EventTimeline } from './EventTimeline'
import logoSrc from '@/assets/logo.png'
import styles from './SidePanel.module.css'

export function SidePanel() {
  return (
    <aside className={styles.panel}>
      <div className={styles.appHeader}>
        <img src={logoSrc} className={styles.appLogo} alt="logo" />
        <div className={styles.appTitleGroup}>
          <div className={styles.appName}>Op2Skill</div>
          <div className={styles.appDesc}>Record → SKILL</div>
        </div>
      </div>

      <div className={`${styles.section} ${styles.sectionFixed}`} style={{ height: 160 }}>
        <h3 className={styles.sectionTitle}>会话信息</h3>
        <div className={styles.sectionContent}><SessionInfo /></div>
      </div>

      <div className={`${styles.section} ${styles.sectionFixed}`} style={{ height: 90 }}>
        <h3 className={styles.sectionTitle}>时间轴</h3>
        <div className={styles.sectionContent}><EventTimeline /></div>
      </div>

      <div className={`${styles.section} ${styles.sectionGrow}`}>
        <h3 className={styles.sectionTitle}>录制历史</h3>
        <div className={`${styles.sectionContent} ${styles.sectionContentGrow}`}><SessionList /></div>
      </div>
    </aside>
  )
}
