import { useState, useEffect, useCallback } from 'react'
import { Modal } from '../common/Modal'
import styles from './CookieManager.module.css'

interface CookieItem {
  name: string
  value: string
  domain: string
  path: string
  secure: boolean
  httpOnly: boolean
  expirationDate?: number
  session?: boolean
}

interface EditState {
  mode: 'add' | 'edit'
  index: number | null
  url: string
  name: string
  value: string
  domain: string
  path: string
  secure: boolean
  httpOnly: boolean
}

const emptyEdit: EditState = {
  mode: 'add',
  index: null,
  url: '',
  name: '',
  value: '',
  domain: '',
  path: '/',
  secure: true,
  httpOnly: false,
}

interface CookieManagerProps {
  open: boolean
  onClose: () => void
}

export function CookieManager({ open, onClose }: CookieManagerProps) {
  const [cookies, setCookies] = useState<CookieItem[]>([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [edit, setEdit] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)

  const loadCookies = useCallback(async () => {
    setLoading(true)
    try {
      const list = await window.electronAPI?.browserGetCookies()
      setCookies(
        (list ?? []).map((c) => ({
          name: c.name,
          value: c.value,
          domain: c.domain ?? '',
          path: c.path ?? '/',
          secure: c.secure,
          httpOnly: c.httpOnly,
          expirationDate: c.expirationDate,
          session: c.session,
        }))
      )
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setFilter('')
      setEdit(null)
      loadCookies()
    }
  }, [open, loadCookies])

  const filtered = cookies.filter((c) => {
    if (!filter) return true
    const q = filter.toLowerCase()
    return (
      c.domain.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.value.toLowerCase().includes(q)
    )
  })

  const handleDelete = async (cookie: CookieItem) => {
    try {
      const url = `http${cookie.secure ? 's' : ''}://${cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain}${cookie.path}`
      await window.electronAPI?.browserRemoveCookie(url, cookie.name)
      setCookies((prev) => prev.filter((c) => !(c.domain === cookie.domain && c.name === cookie.name && c.path === cookie.path)))
    } catch { /* ignore */ }
  }

  const startEdit = (cookie: CookieItem, idx: number) => {
    const domain = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain
    setEdit({
      mode: 'edit',
      index: idx,
      url: `http${cookie.secure ? 's' : ''}://${domain}`,
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
    })
  }

  const startAdd = () => {
    setEdit({ ...emptyEdit })
  }

  const handleSave = async () => {
    if (!edit) return
    setSaving(true)
    try {
      await window.electronAPI?.browserSetCookie({
        url: edit.url,
        name: edit.name,
        value: edit.value,
        domain: edit.domain,
        path: edit.path,
        secure: edit.secure,
        httpOnly: edit.httpOnly,
      })
      setEdit(null)
      await loadCookies()
    } catch { /* ignore */ } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Cookie 管理" width={640}>
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
            <div className={styles.row2}>
              <label className={styles.label}>
                Name
                <input
                  className={styles.input}
                  value={edit.name}
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                  placeholder="cookie_name"
                />
              </label>
              <label className={styles.label}>
                Value
                <input
                  className={styles.input}
                  value={edit.value}
                  onChange={(e) => setEdit({ ...edit, value: e.target.value })}
                  placeholder="cookie_value"
                />
              </label>
            </div>
            <div className={styles.row2}>
              <label className={styles.label}>
                Domain
                <input
                  className={styles.input}
                  value={edit.domain}
                  onChange={(e) => setEdit({ ...edit, domain: e.target.value })}
                  placeholder=".example.com"
                />
              </label>
              <label className={styles.label}>
                Path
                <input
                  className={styles.input}
                  value={edit.path}
                  onChange={(e) => setEdit({ ...edit, path: e.target.value })}
                  placeholder="/"
                />
              </label>
            </div>
            <div className={styles.checkRow}>
              <label className={styles.checkLabel}>
                <input
                  type="checkbox"
                  checked={edit.secure}
                  onChange={(e) => setEdit({ ...edit, secure: e.target.checked })}
                />
                Secure
              </label>
              <label className={styles.checkLabel}>
                <input
                  type="checkbox"
                  checked={edit.httpOnly}
                  onChange={(e) => setEdit({ ...edit, httpOnly: e.target.checked })}
                />
                HttpOnly
              </label>
            </div>
            <div className={styles.editActions}>
              <button className={styles.cancelBtn} onClick={() => setEdit(null)}>取消</button>
              <button className={styles.saveBtn} onClick={handleSave} disabled={saving || !edit.url || !edit.name}>
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
                placeholder="按域名、名称筛选..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
              <button className={styles.addBtn} onClick={startAdd}>+ 添加</button>
            </div>

            {loading ? (
              <div className={styles.loading}>加载中...</div>
            ) : filtered.length === 0 ? (
              <div className={styles.empty}>暂无 Cookie</div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Domain</th>
                      <th>Name</th>
                      <th>Value</th>
                      <th>Path</th>
                      <th>属性</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c, idx) => (
                      <tr key={`${c.domain}-${c.name}-${c.path}-${idx}`}>
                        <td className={styles.mono} title={c.domain}>{c.domain}</td>
                        <td title={c.name}>{c.name}</td>
                        <td className={styles.valueCell} title={c.value}>
                          {c.value.length > 40 ? c.value.slice(0, 40) + '...' : c.value}
                        </td>
                        <td>{c.path}</td>
                        <td>
                          {c.secure && <span className={styles.badge}>S</span>}
                          {c.httpOnly && <span className={styles.badge}>H</span>}
                        </td>
                        <td className={styles.actions}>
                          <button className={styles.iconBtn} onClick={() => startEdit(c, idx)} title="编辑">✎</button>
                          <button className={styles.iconBtn} onClick={() => handleDelete(c)} title="删除">✕</button>
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
