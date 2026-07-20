import { useState, useEffect, useCallback } from 'react'
import { Modal } from '../common/Modal'
import styles from './ImportManager.module.css'

interface ChromeProfileInfo {
  id: string
  name: string
  path: string
  cookiesPath?: string
  hasCookies: boolean
  hasPasswords: boolean
}

interface ImportResult {
  cookiesImported: number
  cookiesSkipped: number
  passwordsImported: number
  passwordsSkipped: number
  errors: string[]
}

interface ImportManagerProps {
  open: boolean
  onClose: () => void
  onImported?: () => void
}

export function ImportManager({ open, onClose, onImported }: ImportManagerProps) {
  const [profiles, setProfiles] = useState<ChromeProfileInfo[]>([])
  const [profileId, setProfileId] = useState('')
  const [importCookies, setImportCookies] = useState(true)
  const [importPasswords, setImportPasswords] = useState(false)
  const [domainFilter, setDomainFilter] = useState('')
  const [loadingProfiles, setLoadingProfiles] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const loadProfiles = useCallback(async () => {
    setLoadingProfiles(true)
    try {
      const list = await window.electronAPI?.browserListChromeProfiles()
      const next = list ?? []
      setProfiles(next)
      setProfileId((current) => {
        if (current && next.some((profile) => profile.id === current)) return current
        return next[0]?.id ?? ''
      })
    } catch {
      setProfiles([])
      setProfileId('')
    } finally {
      setLoadingProfiles(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setResult(null)
    setDomainFilter('')
    setImportCookies(true)
    setImportPasswords(false)
    loadProfiles()
  }, [open, loadProfiles])

  const handleImport = async () => {
    if (!profileId || (!importCookies && !importPasswords)) return
    setImporting(true)
    setResult(null)
    try {
      const importResult = await window.electronAPI?.browserImportCredentials({
        profileId,
        importCookies,
        importPasswords,
        domainFilter: domainFilter.trim() || undefined,
      })
      setResult(importResult ?? null)
      if (importResult && (importResult.cookiesImported > 0 || importResult.passwordsImported > 0)) {
        onImported?.()
      }
    } catch (error) {
      setResult({
        cookiesImported: 0,
        cookiesSkipped: 0,
        passwordsImported: 0,
        passwordsSkipped: 0,
        errors: [error instanceof Error ? error.message : '导入失败'],
      })
    } finally {
      setImporting(false)
    }
  }

  const selectedProfile = profiles.find((profile) => profile.id === profileId)
  const canImportCookies = importCookies && !!selectedProfile?.hasCookies
  const canImportPasswords = importPasswords && !!selectedProfile?.hasPasswords

  return (
    <Modal open={open} onClose={onClose} title="导入 Cookie 和密码" width={560}>
      <div className={styles.container}>
        <p className={styles.desc}>
          从本机 Chrome 配置导入登录态。密钥通过 keytar 从系统钥匙串读取，密码与现有条目冲突时将自动合并跳过。
        </p>

        {loadingProfiles ? (
          <div className={styles.empty}>正在检测 Chrome 配置...</div>
        ) : profiles.length === 0 ? (
          <div className={styles.empty}>未找到 Chrome 配置文件</div>
        ) : (
          <>
            <label className={styles.field}>
              <span className={styles.label}>Chrome 配置</span>
              <select
                className={styles.select}
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
              >
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name} ({profile.id})
                    {!profile.hasCookies && !profile.hasPasswords ? ' — 无数据' : ''}
                  </option>
                ))}
              </select>
              {selectedProfile && (
                <p className={styles.hint}>
                  Cookie: {selectedProfile.hasCookies ? '有' : '无'} · 密码: {selectedProfile.hasPasswords ? '有' : '无'}
                </p>
              )}
            </label>

            <div className={styles.checkRow}>
              <label className={styles.checkLabel}>
                <input
                  type="checkbox"
                  checked={importCookies}
                  onChange={(e) => setImportCookies(e.target.checked)}
                  disabled={!selectedProfile?.hasCookies}
                />
                导入 Cookie
              </label>
              <label className={styles.checkLabel}>
                <input
                  type="checkbox"
                  checked={importPasswords}
                  onChange={(e) => setImportPasswords(e.target.checked)}
                  disabled={!selectedProfile?.hasPasswords}
                />
                导入密码
              </label>
            </div>

            <label className={styles.field}>
              <span className={styles.label}>域名过滤（可选）</span>
              <input
                className={styles.input}
                type="text"
                value={domainFilter}
                onChange={(e) => setDomainFilter(e.target.value)}
                placeholder="例如 github.com，留空则导入全部"
              />
            </label>

            {result && (
              <div className={styles.result}>
                <p className={styles.resultTitle}>导入结果</p>
                <ul className={styles.resultList}>
                  <li>Cookie：成功 {result.cookiesImported} 条，跳过 {result.cookiesSkipped} 条</li>
                  <li>密码：新增 {result.passwordsImported} 条，跳过 {result.passwordsSkipped} 条</li>
                </ul>
                {result.errors.length > 0 && (
                  <div className={styles.errorList}>
                    {result.errors.slice(0, 8).map((error, index) => (
                      <div key={`${error}-${index}`}>{error}</div>
                    ))}
                    {result.errors.length > 8 && <div>... 还有 {result.errors.length - 8} 条错误</div>}
                  </div>
                )}
              </div>
            )}

            <div className={styles.actions}>
              <button className={styles.cancelBtn} onClick={onClose} disabled={importing}>
                关闭
              </button>
              <button
                className={styles.importBtn}
                onClick={handleImport}
                disabled={importing || !profileId || (!canImportCookies && !canImportPasswords)}
              >
                {importing ? '导入中...' : '开始导入'}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
