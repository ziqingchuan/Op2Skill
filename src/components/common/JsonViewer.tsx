import { useState, useCallback } from 'react'
import styles from './JsonViewer.module.css'

interface JsonViewerProps {
  data: unknown
  initialCollapsed?: boolean
  maxHeight?: string
}

export function JsonViewer({ data, initialCollapsed = false, maxHeight = '600px' }: JsonViewerProps) {
  return (
    <div className={styles.viewer} style={{ maxHeight, overflowY: 'auto' }}>
      <JsonNode value={data} depth={0} initialCollapsed={initialCollapsed} />
    </div>
  )
}

interface JsonNodeProps {
  value: unknown
  depth: number
  keyName?: string
  isLast?: boolean
  initialCollapsed?: boolean
}

function JsonNode({ value, depth, keyName, isLast = true, initialCollapsed = false }: JsonNodeProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed && depth === 0)
  const toggle = useCallback(() => setCollapsed((v) => !v), [])
  const indent = depth * 16

  const renderKey = () =>
    keyName !== undefined ? (
      <span className={styles.key}>"{keyName}"</span>
    ) : null

  const colon = keyName !== undefined ? <span className={styles.punct}>: </span> : null
  const comma = !isLast ? <span className={styles.punct}>,</span> : null

  if (value === null) {
    return (
      <div className={styles.line} style={{ paddingLeft: indent }}>
        {renderKey()}{colon}<span className={styles.null}>null</span>{comma}
      </div>
    )
  }

  if (typeof value === 'boolean') {
    return (
      <div className={styles.line} style={{ paddingLeft: indent }}>
        {renderKey()}{colon}<span className={styles.bool}>{String(value)}</span>{comma}
      </div>
    )
  }

  if (typeof value === 'number') {
    return (
      <div className={styles.line} style={{ paddingLeft: indent }}>
        {renderKey()}{colon}<span className={styles.number}>{value}</span>{comma}
      </div>
    )
  }

  if (typeof value === 'string') {
    return (
      <div className={styles.line} style={{ paddingLeft: indent }}>
        {renderKey()}{colon}<span className={styles.string}>"{escapeStr(value)}"</span>{comma}
      </div>
    )
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <div className={styles.line} style={{ paddingLeft: indent }}>
          {renderKey()}{colon}<span className={styles.punct}>[]</span>{comma}
        </div>
      )
    }
    return (
      <div>
        <div className={styles.line} style={{ paddingLeft: indent }}>
          <button className={styles.toggle} onClick={toggle} aria-label={collapsed ? '展开' : '折叠'}>
            {collapsed ? '▶' : '▼'}
          </button>
          {renderKey()}{colon}
          <span className={styles.punct}>[</span>
          {collapsed && (
            <span className={styles.ellipsis} onClick={toggle}>{value.length} 项</span>
          )}
          {collapsed && <span className={styles.punct}>]</span>}
          {collapsed && comma}
        </div>
        {!collapsed && (
          <>
            {value.map((item, i) => (
              <JsonNode
                key={i}
                value={item}
                depth={depth + 1}
                isLast={i === value.length - 1}
              />
            ))}
            <div className={styles.line} style={{ paddingLeft: indent }}>
              <span className={styles.punct}>]</span>{comma}
            </div>
          </>
        )}
      </div>
    )
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) {
      return (
        <div className={styles.line} style={{ paddingLeft: indent }}>
          {renderKey()}{colon}<span className={styles.punct}>{'{}'}</span>{comma}
        </div>
      )
    }
    return (
      <div>
        <div className={styles.line} style={{ paddingLeft: indent }}>
          <button className={styles.toggle} onClick={toggle} aria-label={collapsed ? '展开' : '折叠'}>
            {collapsed ? '▶' : '▼'}
          </button>
          {renderKey()}{colon}
          <span className={styles.punct}>{'{'}</span>
          {collapsed && (
            <span className={styles.ellipsis} onClick={toggle}>{entries.length} 个键</span>
          )}
          {collapsed && <span className={styles.punct}>{'}'}</span>}
          {collapsed && comma}
        </div>
        {!collapsed && (
          <>
            {entries.map(([k, v], i) => (
              <JsonNode
                key={k}
                value={v}
                depth={depth + 1}
                keyName={k}
                isLast={i === entries.length - 1}
              />
            ))}
            <div className={styles.line} style={{ paddingLeft: indent }}>
              <span className={styles.punct}>{'}'}</span>{comma}
            </div>
          </>
        )}
      </div>
    )
  }

  return null
}

function escapeStr(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t')
}
