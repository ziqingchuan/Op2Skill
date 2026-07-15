import type { RecordedEvent } from '@/types/events'

export interface SemanticStep {
  id: string
  summary: string
  events: RecordedEvent[]
  type: 'action' | 'navigation' | 'input' | 'download'
}

/**
 * Infer high-level semantic steps from the raw event stream.
 * Groups related events into meaningful steps.
 */
export function inferSemanticSteps(events: RecordedEvent[]): SemanticStep[] {
  const steps: SemanticStep[] = []
  let i = 0

  while (i < events.length) {
    const event = events[i]

    if (event.type === 'navigation') {
      const fromUrl = event.data?.fromUrl ?? ''
      const toUrl = event.data?.toUrl ?? event.tabUrl
      steps.push({
        id: `step-${i}`,
        summary: `Navigate to ${simplifyUrl(toUrl)}${fromUrl ? ` (from ${simplifyUrl(fromUrl)})` : ''}`,
        events: [event],
        type: 'navigation',
      })
      i++
      continue
    }

    if (event.type === 'file_download') {
      steps.push({
        id: `step-${i}`,
        summary: `Download file: ${event.data?.filename ?? 'unknown'}`,
        events: [event],
        type: 'download',
      })
      i++
      continue
    }

    // Group consecutive input events on the same element
    if (event.type === 'input' || event.type === 'change') {
      const group = [event]
      const selector = event.target?.cssSelector
      let j = i + 1
      while (j < events.length && (events[j].type === 'input' || events[j].type === 'change') && events[j].target?.cssSelector === selector) {
        group.push(events[j])
        j++
      }
      const lastVal = group[group.length - 1].data?.value
      const target = event.target
      const label = target?.ariaLabel || target?.placeholder || target?.textContent || target?.tagName?.toLowerCase() || 'field'
      steps.push({
        id: `step-${i}`,
        summary: `Type "${lastVal ?? ''}" in ${label}`,
        events: group,
        type: 'input',
      })
      i = j
      continue
    }

    // Click
    if (event.type === 'click' || event.type === 'dblclick') {
      const target = event.target
      const label = target?.ariaLabel || target?.textContent || target?.tagName?.toLowerCase() || 'element'
      steps.push({
        id: `step-${i}`,
        summary: `${event.type === 'dblclick' ? 'Double-click' : 'Click'} "${truncate(label, 40)}"`,
        events: [event],
        type: 'action',
      })
      i++
      continue
    }

    // Keydown shortcut
    if (event.type === 'keydown') {
      const d = event.data
      if (d?.ctrlKey || d?.metaKey) {
        const combo = `${d.metaKey ? '⌘' : 'Ctrl'}+${d.key}`
        steps.push({
          id: `step-${i}`,
          summary: `Keyboard shortcut: ${combo}`,
          events: [event],
          type: 'action',
        })
        i++
        continue
      }
    }

    // Skip noise or unrecognized
    i++
  }

  return steps
}

function simplifyUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.hostname + (u.pathname !== '/' ? u.pathname : '')
  } catch {
    return url
  }
}

function truncate(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > max ? t.slice(0, max) + '…' : t
}

/**
 * Extract candidate parameters from input events.
 * Returns a deduplicated list of { name, value, selector }.
 */
export function extractCandidateParams(events: RecordedEvent[]): Array<{ name: string; value: string; selector: string }> {
  const seen = new Set<string>()
  const params: Array<{ name: string; value: string; selector: string }> = []

  for (const ev of events) {
    if ((ev.type === 'input' || ev.type === 'change') && ev.data?.value && !ev.target?.isPassword) {
      const val = ev.data.value
      const key = `${ev.target?.cssSelector ?? ''}::${val}`
      if (!seen.has(key) && val.trim().length > 0) {
        seen.add(key)
        const name = ev.target?.ariaLabel || ev.target?.placeholder || ev.target?.id || 'param'
        params.push({
          name: toParamName(name),
          value: val,
          selector: ev.target?.cssSelector ?? '',
        })
      }
    }
  }

  return params
}

function toParamName(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 30) || 'input_value'
}
