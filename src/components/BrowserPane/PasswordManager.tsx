import { useState, useEffect, useCallback } from 'react'
import { Modal } from '../common/Modal'
import styles from './PasswordManager.module.css'

interface PasswordEntry {
  url: string
  username: string
  password: string
}

interface EditState {
  mode: 'add' | 'edit'
  index: number
  url: string
  username: string
  password: string
}

const emptyEdit: EditState = { mode: 'add', index: -1, url: '', username: '', password: '' }

interface PasswordManagerProps {
  open: boolean
  onClose: () => void
}

export function PasswordManager({ open, onClose }: PasswordManagerProps) {
  const [passwords, setPasswords] = useState<PasswordEntry[]>([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [visibleIdx, setVisibleIdx] = useState<Set<number>>(new Set())
  const [edit, setEdit] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)

  const loadPasswords = useCallback(async () => {
    setLoading(true)
    try {
      const list = await window.electronAPI?.browserGetPasswords()
      setPasswords(list ?? [])
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setFilter('')
      setVisibleIdx(new Set())
      setEdit(null)
      loadPasswords()
    }
  }, [open, loadPasswords])

  const filtered = passwords.filter((p) => {
    if (!filter) return true
    const q = filter.toLowerCase()
    return p.url.toLowerCase().includes(q) || p.username.toLowerCase().includes(q)
  })

  const toggleVisible = (idx: number) => {
    setVisibleIdx((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const handleDelete = async (idx: number) => {
    const next = passwords.filter((_, i) => i !== idx)
    setPasswords(next)
    try {
      await window.electronAPI?.browserSavePasswords(next)
    } catch { /* ignore */ }
  }

  const startEdit = (entry: PasswordEntry, idx: number) => {
    setEdit({ mode: 'edit', index: idx, url: entry.url, username: entry.username, password: entry.password })
  }

  const startAdd = () => {
    setEdit({ ...emptyEdit })
  }

  const handleSave = async () => {
    if (!edit) return
    setSaving(true)
    try {
      const next = [...passwords]
      if (edit.mode === 'edit' && edit.index >= 0) {
        next[edit.index] = { url: edit.url, username: edit.username, password: edit.password }
      } else {
        next.push({ url: edit.url, username: edit.username, password: edit.password })
      }
      await window.electronAPI?.browserSavePasswords(next)
      setPasswords(next)
      setEdit(null)
    } catch { /* ignore */ } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="密码管理" width={640}>
      <div className={styles.container}>
        {edit ? (
          <div className={styles.editForm}>
            <label className={styles.label}>
              URL
              <input
                className={styles.input}
                value={edit.url}
                onChange={(e) => setEdit({ ...edit, url: e.target.value })}
                placeholder="https://example.com"
              />
            </label>
            <label className={styles.label}>
              用户名
              <input
                className={styles.input}
                value={edit.username}
                onChange={(e) => setEdit({ ...edit, username: e.target.value })}
                placeholder="user@example.com"
              />
            </label>
            <label className={styles.label}>
              密码
              <input
                className={styles.input}
                type="text"
                value={edit.password}
                onChange={(e) => setEdit({ ...edit, password: e.target.value })}
                placeholder="password"
              />
            </label>
            <div className={styles.editActions}>
              <button className={styles.cancelBtn} onClick={() => setEdit(null)}>取消</button>
              <button className={styles.saveBtn} onClick={handleSave} disabled={saving || !edit.url}>
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.toolbar}>
              <input
                className={styles.searchInput}
                type="text"
                placeholder="按 URL、用户名筛选..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
              <button className={styles.addBtn} onClick={startAdd}>+ 添加</button>
            </div>

            {loading ? (
              <div className={styles.loading}>加载中...</div>
            ) : filtered.length === 0 ? (
              <div className={styles.empty}>暂无已保存的密码</div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>URL</th>
                      <th>用户名</th>
                      <th>密码</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p, idx) => (
                      <tr key={`${p.url}-${p.username}-${idx}`}>
                        <td className={styles.mono} title={p.url}>
                          {p.url.length > 40 ? p.url.slice(0, 40) + '...' : p.url}
                        </td>
                        <td>{p.username}</td>
                        <td className={styles.passwordCell}>
                          {visibleIdx.has(idx) ? (
                            <span className={styles.passwordText}>{p.password}</span>
                          ) : (
                            <span className={styles.passwordMask}>••••••••</span>
                          )}
                          <button className={styles.eyeBtn} onClick={() => toggleVisible(idx)} title={visibleIdx.has(idx) ? '隐藏' : '显示'}>
                            {visibleIdx.has(idx) ? '◉' : '○'}
                          </button>
                        </td>
                        <td className={styles.actions}>
                          <button className={styles.iconBtn} onClick={() => startEdit(p, idx)} title="编辑">✎</button>
                          <button className={styles.iconBtn} onClick={() => handleDelete(idx)} title="删除">✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
