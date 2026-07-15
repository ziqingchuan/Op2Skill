import { useRef, useState, useCallback, useEffect } from 'react'
import styles from './BrowserPane.module.css'
import { CookieManager } from './CookieManager'
import { PasswordManager } from './PasswordManager'

const isElectron =
  typeof window !== 'undefined' &&
  !!(window as Window & { electronAPI?: { isElectron: boolean } }).electronAPI?.isElectron

type ModalType = 'cookie' | 'password' | null

interface BrowserPaneProps {
  isRecording: boolean
}

export function BrowserPane({ isRecording }: BrowserPaneProps) {
  const browserHostRef = useRef<HTMLDivElement>(null)
  const [inputUrl, setInputUrl] = useState('https://www.baidu.com')
  const [hasLoadedUrl, setHasLoadedUrl] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [activeModal, setActiveModal] = useState<ModalType>(null)
  const modalOpenRef = useRef(false)

  const setModalOpen = (type: ModalType) => {
    setActiveModal(type)
    modalOpenRef.current = type !== null
    if (isElectron) {
      window.electronAPI?.browserSetModalVisible(type !== null).catch(() => {})
    }
  }

  const syncBounds = useCallback(() => {
    if (!isElectron || !browserHostRef.current || modalOpenRef.current) return
    const rect = browserHostRef.current.getBoundingClientRect()
    window.electronAPI?.setBrowserBounds({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!isElectron) return

    const unsubscribe = window.electronAPI?.onBrowserStateChange((state) => {
      setInputUrl(state.url)
      setIsLoading(state.isLoading)
      setCanGoBack(state.canGoBack)
      setCanGoForward(state.canGoForward)
      if (state.url) setHasLoadedUrl(true)
    })

    return () => unsubscribe?.()
  }, [])

  useEffect(() => {
    if (!isElectron) return
    const unsubscribe = window.electronAPI?.onOpenBrowserModal((type) => {
      setModalOpen(type)
    })
    return () => unsubscribe?.()
  }, [])

  useEffect(() => {
    syncBounds()
    if (!browserHostRef.current) return

    const resizeObserver = new ResizeObserver(() => syncBounds())
    resizeObserver.observe(browserHostRef.current)
    window.addEventListener('resize', syncBounds)
    window.addEventListener('scroll', syncBounds, true)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', syncBounds)
      window.removeEventListener('scroll', syncBounds, true)
      window.electronAPI?.setBrowserBounds({ x: 0, y: 0, width: 0, height: 0 }).catch(() => {})
    }
  }, [syncBounds])

  useEffect(() => {
    const frame = requestAnimationFrame(syncBounds)
    return () => cancelAnimationFrame(frame)
  })

  const navigate = useCallback((url: string) => {
    let normalized = url.trim()
    if (!normalized) return
    if (!/^https?:\/\//i.test(normalized)) normalized = 'https://' + normalized

    setInputUrl(normalized)
    setHasLoadedUrl(true)
    setIsLoading(true)

    if (isElectron) {
      window.electronAPI?.navigateBrowser(normalized).catch(() => setIsLoading(false))
    }
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') navigate(inputUrl)
  }

  const goBack = () => {
    if (isElectron) window.electronAPI?.browserBack().catch(() => {})
  }

  const goForward = () => {
    if (isElectron) window.electronAPI?.browserForward().catch(() => {})
  }

  const reload = () => {
    setIsLoading(true)
    if (isElectron) window.electronAPI?.browserReload().catch(() => setIsLoading(false))
  }

  const showContextMenu = () => {
    if (isElectron) window.electronAPI?.browserShowContextMenu().catch(() => {})
  }

  return (
    <div className={styles.pane}>
      <div className={styles.toolbar}>
        <button className={styles.navBtn} onClick={goBack} title="后退" disabled={!canGoBack}>←</button>
        <button className={styles.navBtn} onClick={goForward} title="前进" disabled={!canGoForward}>→</button>
        <button className={styles.navBtn} onClick={reload} title="刷新" disabled={!hasLoadedUrl}>↺</button>
        <div className={styles.urlBar}>
          {isRecording && <span className={styles.recDot} title="录制中" />}
          <input
            className={styles.urlInput}
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            aria-label="地址栏"
          />
          <button className={styles.goBtn} onClick={() => navigate(inputUrl)}>前往</button>
        </div>
        <button className={styles.menuBtn} onClick={showContextMenu} title="浏览器设置">⋮</button>
      </div>

      <div className={styles.frameWrap}>
        {isLoading && (
          <div className={styles.loadingBar}>
            <div className={styles.loadingProgress} />
          </div>
        )}

        <div ref={browserHostRef} className={styles.nativeBrowserHost} />

        {!hasLoadedUrl && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>◎</div>
            <p className={styles.emptyTitle}>在地址栏输入网址，按回车访问</p>
            <p className={styles.emptyDesc}>
              {isElectron ? '支持访问任意网站' : '请在 Electron 应用中使用原生内嵌浏览器'}
            </p>
            <div className={styles.quickLinks}>
              {['https://www.baidu.com', 'https://github.com', 'http://localhost:3000'].map((url) => (
                <button key={url} className={styles.quickLink} onClick={() => navigate(url)}>
                  {url}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <CookieManager
        open={activeModal === 'cookie'}
        onClose={() => setModalOpen(null)}
      />
      <PasswordManager
        open={activeModal === 'password'}
        onClose={() => setModalOpen(null)}
      />
    </div>
  )
}
