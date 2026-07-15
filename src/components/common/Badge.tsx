import {
  SelectOutlined,
  FormOutlined,
  EditOutlined,
  ArrowRightOutlined,
  VerticalAlignMiddleOutlined,
  AimOutlined,
  MinusCircleOutlined,
  CopyOutlined,
  SnippetsOutlined,
  DragOutlined,
  StopOutlined,
  DownloadOutlined,
} from '@ant-design/icons'
import type { EventType } from '@/types/events'
import styles from './Badge.module.css'

interface BadgeProps {
  type: EventType | string
  compact?: boolean
}

type AntIconProps = { style?: React.CSSProperties }
type IconComponent = (props: AntIconProps) => React.ReactElement

const ICON_STYLE = { fontSize: 10 }

const EVENT_META: Record<string, { label: string; colorVar: string; Icon: IconComponent }> = {
  click:         { label: 'click',    colorVar: '--color-event-click',      Icon: (p) => <SelectOutlined style={{ ...ICON_STYLE, ...p.style }} /> },
  dblclick:      { label: 'dblclick', colorVar: '--color-event-click',      Icon: (p) => <SelectOutlined style={{ ...ICON_STYLE, ...p.style }} /> },
  input:         { label: 'input',    colorVar: '--color-event-input',      Icon: (p) => <FormOutlined style={{ ...ICON_STYLE, ...p.style }} /> },
  change:        { label: 'change',   colorVar: '--color-event-input',      Icon: (p) => <EditOutlined style={{ ...ICON_STYLE, ...p.style }} /> },
  keydown:       { label: 'key',      colorVar: '--color-event-keydown',    Icon: (p) => <FormOutlined style={{ ...ICON_STYLE, ...p.style }} /> },
  scroll:        { label: 'scroll',   colorVar: '--color-event-scroll',     Icon: (p) => <VerticalAlignMiddleOutlined style={{ ...ICON_STYLE, ...p.style }} /> },
  focus:         { label: 'focus',    colorVar: '--color-event-scroll',     Icon: (p) => <AimOutlined style={{ ...ICON_STYLE, ...p.style }} /> },
  blur:          { label: 'blur',     colorVar: '--color-event-scroll',     Icon: (p) => <MinusCircleOutlined style={{ ...ICON_STYLE, ...p.style }} /> },
  navigation:    { label: 'nav', colorVar: '--color-event-navigation', Icon: (p) => <ArrowRightOutlined style={{ ...ICON_STYLE, ...p.style }} /> },
  file_download: { label: 'download', colorVar: '--color-event-file',       Icon: (p) => <DownloadOutlined style={{ ...ICON_STYLE, ...p.style }} /> },
  copy:          { label: 'copy',     colorVar: '--color-event-clipboard',  Icon: (p) => <CopyOutlined style={{ ...ICON_STYLE, ...p.style }} /> },
  paste:         { label: 'paste',    colorVar: '--color-event-clipboard',  Icon: (p) => <SnippetsOutlined style={{ ...ICON_STYLE, ...p.style }} /> },
  drag_start:    { label: 'drag',     colorVar: '--color-event-click',      Icon: (p) => <DragOutlined style={{ ...ICON_STYLE, ...p.style }} /> },
  drop:          { label: 'drop',     colorVar: '--color-event-click',      Icon: (p) => <DragOutlined style={{ ...ICON_STYLE, ...p.style }} /> },
  frame_blocked: { label: 'blocked',  colorVar: '--color-event-scroll',     Icon: (p) => <StopOutlined style={{ ...ICON_STYLE, ...p.style }} /> },
}

export function Badge({ type, compact = false }: BadgeProps) {
  const meta = EVENT_META[type]
  const colorVar = meta?.colorVar ?? '--color-text-muted'
  const label = meta?.label ?? type
  const Icon = meta?.Icon

  return (
    <span
      className={`${styles.badge} ${compact ? styles.compact : ''}`}
      style={{ '--badge-color': `var(${colorVar})` } as React.CSSProperties}
      title={type}
    >
      <span className={styles.icon}>
        {Icon ? <Icon /> : '•'}
      </span>
      {!compact && <span className={styles.label}>{label}</span>}
    </span>
  )
}
