import { useUIStore } from '@/store/uiStore'
import type { EventType } from '@/types/events'
import styles from './FilterBar.module.css'

const FILTER_TYPES: { type: EventType; label: string }[] = [
  { type: 'click', label: 'click' },
  { type: 'input', label: 'input' },
  { type: 'keydown', label: 'keydown' },
  { type: 'navigation', label: 'navigation' },
  { type: 'scroll', label: 'scroll' },
  { type: 'file_download', label: 'download' },
  { type: 'copy', label: 'copy' },
  { type: 'paste', label: 'paste' },
]

export function FilterBar() {
  const { filter, toggleFilterType, setSearchQuery, resetFilter } = useUIStore()

  const hasFilter = filter.types.length > 0 || filter.searchQuery.length > 0

  return (
    <div className={styles.filterBar}>
      <div className={styles.searchRow}>
        <div className={styles.searchWrapper}>
          <span className={styles.searchIcon}>⌕</span>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="搜索事件…"
            value={filter.searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="搜索事件"
          />
          {filter.searchQuery && (
            <button className={styles.clearBtn} onClick={() => setSearchQuery('')} aria-label="清除搜索">
              ✕
            </button>
          )}
        </div>
        {hasFilter && (
          <button className={styles.resetBtn} onClick={resetFilter} title="重置所有筛选">
            重置
          </button>
        )}
      </div>
      <div className={styles.typeFilters} role="group" aria-label="按事件类型筛选">
        {FILTER_TYPES.map(({ type, label }) => (
          <button
            key={type}
            className={`${styles.typeBtn} ${filter.types.includes(type) ? styles.active : ''}`}
            onClick={() => toggleFilterType(type)}
            aria-pressed={filter.types.includes(type)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
