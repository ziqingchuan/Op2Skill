import { useCallback, useRef, useState, useEffect } from 'react'
import { useEventStore } from '@/store/eventStore'
import { useSessionStore, useActiveSession } from '@/store/sessionStore'
import { useUIStore } from '@/store/uiStore'
import { exportJson, exportMarkdown } from '@/services/exporter'
import { Button } from '@/components/common/Button'
import { SidePanel } from '@/components/SidePanel/SidePanel'
import { EventList } from '@/components/EventsView/EventList'
import { SkillView } from '@/components/SkillView/SkillView'
import { JsonPreview } from '@/components/JsonPreview/JsonPreview'
import { Header } from '@/components/Header/Header'
import { BrowserPane } from '@/components/BrowserPane/BrowserPane'
import type { ActiveTab } from '@/types/ui'
import styles from './App.module.css'

const TABS: { id: ActiveTab; label: string }[] = [
  { id: 'events', label: '事件记录' },
  { id: 'skill', label: 'SKILL.md' },
  { id: 'preview', label: 'JSON 预览' },
]

export default function App() {
  const { recordingState } = useEventStore()
  const activeSession = useActiveSession()
  const { activeTab, setActiveTab, skillGenerateState } = useUIStore()

  const [splitPct, setSplitPct] = useState(55)
  const isDragging = useRef(false)
  const splitAreaRef = useRef<HTMLDivElement>(null)

  // Load sessions from disk on startup
  useEffect(() => {
    useSessionStore.getState().loadSessions()
  }, [])

  const hasData = (activeSession?.events.length ?? 0) > 0
  const skillMarkdown = activeSession?.skillMarkdown ?? ''
  const eventCount = activeSession?.events.length ?? 0

  const handleExportJson = () => {
    if (activeSession?.meta) exportJson(activeSession.events, activeSession.meta)
  }
  const handleExportSkill = () => { exportMarkdown(skillMarkdown) }

  const onDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    isDragging.current = true
    const areaRect = splitAreaRef.current?.getBoundingClientRect()
    if (!areaRect) return

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return
      const pct = ((ev.clientX - areaRect.left) / areaRect.width) * 100
      setSplitPct(Math.min(Math.max(pct, 20), 78))
    }
    const onUp = () => {
      isDragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div className={styles.app}>
      <Header />

      <div className={styles.body}>
        <SidePanel />

        <div className={styles.splitArea} ref={splitAreaRef}>
          <div className={styles.browserSide} style={{ width: `${splitPct}%` }}>
            <BrowserPane isRecording={recordingState === 'recording'} />
          </div>

          <div className={styles.divider} onMouseDown={onDividerMouseDown} title="拖拽调整宽度" />

          <div className={styles.rightSide}>
            <div className={styles.tabBar}>
              <div className={styles.tabs}>
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                    aria-selected={activeTab === tab.id}
                    role="tab"
                  >
                    {tab.label}
                    {tab.id === 'events' && eventCount > 0 && (
                      <span className={styles.tabCount}>{eventCount}</span>
                    )}
                    {tab.id === 'skill' && skillGenerateState === 'done' && (
                      <span className={styles.tabDot} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.content} role="tabpanel">
              {activeTab === 'events' && <EventList />}
              {activeTab === 'skill' && <SkillView />}
              {activeTab === 'preview' && <JsonPreview />}
            </div>
          </div>
        </div>
      </div>

      <footer className={styles.footer}>
        <div className={styles.footerLeft}>
          <span className={styles.footerInfo}>
            {hasData
              ? `${eventCount} 个事件`
              : '输入网址，点击「开始录制」后开始操作'}
          </span>
        </div>
        <div className={styles.footerActions}>
          <Button variant="secondary" size="sm" disabled={!hasData} onClick={handleExportJson} icon="↓">
            导出 JSON
          </Button>
          <Button variant="secondary" size="sm" disabled={!skillMarkdown} onClick={handleExportSkill} icon="↓">
            导出 SKILL.md
          </Button>
        </div>
      </footer>
    </div>
  )
}
