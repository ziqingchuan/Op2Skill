import { useState, useRef } from 'react'
import { EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { useSessionStore } from '@/store/sessionStore'
import styles from './SessionList.module.css'

export function SessionList() {
  const { sessions, activeSessionId, setActiveSession, renameSession, deleteSession } = useSessionStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const startRename = (e: React.MouseEvent, id: string, currentTitle: string) => {
    e.stopPropagation()
    setEditingId(id)
    setEditValue(currentTitle)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const commitRename = () => {
    if (editingId) {
      const trimmed = editValue.trim()
      if (trimmed) renameSession(editingId, trimmed)
    }
    setEditingId(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitRename()
    if (e.key === 'Escape') setEditingId(null)
  }

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    deleteSession(id)
  }

  if (sessions.length === 0) {
    return (
      <div className={styles.empty}>
        暂无录制记录
        <br />
        点击「开始录制」创建第一条
      </div>
    )
  }

  return (
    <ul className={styles.list}>
      {[...sessions].reverse().map((session) => {
        const isActive = session.id === activeSessionId
        const isEditing = editingId === session.id
        const time = new Date(session.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        const eventCount = session.events.length

        return (
          <li
            key={session.id}
            className={`${styles.item} ${isActive ? styles.active : ''}`}
            onClick={() => setActiveSession(session.id)}
          >
            {/* Left: title + meta */}
            <div className={styles.itemContent}>
              {isEditing ? (
                <input
                  ref={inputRef}
                  className={styles.renameInput}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={handleKeyDown}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className={styles.title}>{session.title}</span>
              )}
              <div className={styles.itemMeta}>
                <span>{time}</span>
                <span className={styles.metaDot}>·</span>
                <span>{eventCount} 事件</span>
                {session.skillMarkdown && <span className={styles.skillBadge}>Skill</span>}
              </div>
            </div>

            {/* Right: action buttons, vertically centered */}
            {!isEditing && (
              <div className={styles.actions}>
                <button
                  className={styles.actionBtn}
                  onClick={(e) => startRename(e, session.id, session.title)}
                  title="重命名"
                  aria-label="重命名"
                >
                  <EditOutlined />
                </button>
                <button
                  className={`${styles.actionBtn} ${styles.deleteBtn}`}
                  onClick={(e) => handleDelete(e, session.id)}
                  title="删除"
                  aria-label="删除录制"
                >
                  <DeleteOutlined />
                </button>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
