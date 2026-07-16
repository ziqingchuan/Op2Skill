import type { RecordedEvent, SessionMeta } from '@/types/events'

/**
 * Export events and session meta as events.json file download.
 */
export function exportJson(events: RecordedEvent[], meta: SessionMeta): void {
  const payload = { meta, events }
  const json = JSON.stringify(payload, null, 2)
  downloadFile(json, `events-${meta.sessionId.slice(0, 8)}.json`, 'application/json')
}

/**
 * Export skill markdown as skill.md file download.
 */
export function exportMarkdown(skillMarkdown: string): void {
  downloadFile(skillMarkdown, 'SKILL.md', 'text/markdown')
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

