import type { RecordedEvent, RecordingSession, SessionMeta } from '@/types/events'
import { inferSemanticSteps, extractCandidateParams } from '@/utils/semanticStep'

export async function generateSkill(
  events: RecordedEvent[],
  meta: SessionMeta
): Promise<{ normalized: string; raw: string }> {
  const session: RecordingSession = { meta, events }
  if (window.electronAPI?.generateSkill) {
    const result = await window.electronAPI.generateSkill(session)
    if (result && typeof result === 'object' && 'normalized' in result) {
      return result as { normalized: string; raw: string }
    }
    // fallback: treat as plain string (e.g. non-Electron dev mode)
    return { normalized: String(result), raw: String(result) }
  }

  const md = buildSkillMarkdown(events, meta)
  return { normalized: md, raw: md }
}

function buildSkillMarkdown(events: RecordedEvent[], meta: SessionMeta): string {
  const steps = inferSemanticSteps(events)
  const params = extractCandidateParams(events)

  // Collect unique URLs
  const urls = [...new Set(events.map((e) => {
    try { return new URL(e.tabUrl).hostname }
    catch { return e.tabUrl }
  }).filter(Boolean))].slice(0, 8)

  const pageTitles = [...new Set(events.map((e) => e.tabTitle).filter(Boolean))].slice(0, 6)

  // Assertions from navigation and download events
  const assertions: string[] = []
  for (const e of events) {
    if (e.type === 'navigation' && e.data?.toUrl) {
      assertions.push(`Page URL contains \`${simplifyUrl(String(e.data.toUrl))}\``)
    }
    if (e.type === 'file_download' && e.data?.filename) {
      assertions.push(`File \`${e.data.filename}\` exists in downloads directory`)
    }
  }
  const uniqueAssertions = [...new Set(assertions)].slice(0, 5)

  const skillName = 'Recorded Workflow'

  const now = new Date(meta.startTime)

  const lines: string[] = []

  lines.push(`# ${skillName}`)
  lines.push('')
  lines.push(`> Recorded on ${now.toLocaleDateString('zh-CN')} ${now.toLocaleTimeString('zh-CN')} — ${formatDuration(meta.duration ?? 0)}`)
  lines.push('')
  lines.push('---')
  lines.push('')

  // Section: Description
  lines.push('## Description')
  lines.push('')
  lines.push('Auto-generated from the recorded browser workflow.')
  lines.push('')

  // Section: Applicable Scenarios
  lines.push('## Applicable Scenarios')
  lines.push('')
  lines.push('This skill is applicable when you need to:')
  lines.push('')
  lines.push(`- Repeat the workflow demonstrated on: ${urls.join(', ') || '_unknown_'}`)
  if (pageTitles.length > 0) {
    lines.push(`- Work with pages matching: ${pageTitles.map((t) => `\`${t}\``).join(', ')}`)
  }
  lines.push('')

  // Section: Input Parameters
  lines.push('## Input Parameters')
  lines.push('')
  if (params.length > 0) {
    lines.push('| Parameter | Example Value | Description |')
    lines.push('|-----------|---------------|-------------|')
    for (const p of params) {
      lines.push(`| \`{{${p.name}}}\` | \`${p.value}\` | _Auto-extracted — add description here_ |`)
    }
  } else {
    lines.push('_No parameterizable inputs detected._')
  }
  lines.push('')

  // Section: Steps
  lines.push('## Execution Steps')
  lines.push('')
  if (steps.length === 0) {
    lines.push('_No meaningful steps could be inferred from the recorded events._')
  } else {
    steps.forEach((step, idx) => {
      lines.push(`${idx + 1}. ${step.summary}`)
    })
  }
  lines.push('')

  // Section: Assertions
  lines.push('## Result Assertions')
  lines.push('')
  if (uniqueAssertions.length > 0) {
    uniqueAssertions.forEach((a) => lines.push(`- ${a}`))
  } else {
    lines.push('- Workflow completes without JavaScript errors')
    lines.push('- Final page title is not empty')
  }
  lines.push('')

  // Section: Statistics
  lines.push('## Recording Statistics')
  lines.push('')
  lines.push('| Metric | Value |')
  lines.push('|--------|-------|')
  lines.push(`| Total Events | ${events.length} |`)
  lines.push(`| Duration | ${formatDuration(meta.duration ?? 0)} |`)
  lines.push(`| Page Titles | ${pageTitles.length} |`)
  lines.push(`| Unique URLs | ${urls.length} |`)
  lines.push(`| Detected Parameters | ${params.length} |`)
  lines.push('')

  // Footer
  lines.push('---')
  lines.push('')
  lines.push('> **Note**: This skill was auto-generated from a recording. Review each step and update parameter descriptions before sharing.')

  return lines.join('\n')
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return `${m}m ${s % 60}s`
}

function simplifyUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.hostname + u.pathname
  } catch {
    return url
  }
}
