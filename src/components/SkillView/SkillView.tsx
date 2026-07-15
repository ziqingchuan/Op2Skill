import { useState, useMemo, useEffect } from 'react'
import loadingSvg from '@/assets/loading.svg'
import { useActiveSession, useSessionStore } from '@/store/sessionStore'
import { useUIStore } from '@/store/uiStore'
import { generateSkill } from '@/services/skillGenerator'
import { MarkdownRenderer } from './MarkdownRenderer'
import { Button } from '@/components/common/Button'
import styles from './SkillView.module.css'

interface FrontMatter {
  yaml: string
  body: string
}

function splitFrontMatter(content: string): FrontMatter | null {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/)
  if (!match) return null
  return { yaml: match[1], body: content.slice(match[0].length) }
}

function parseYamlPairs(yaml: string): { key: string; value: string }[] {
  const pairs: { key: string; value: string }[] = []
  for (const line of yaml.split('\n')) {
    const m = line.match(/^(\w[\w-]*)\s*:\s*(.+)$/)
    if (m) pairs.push({ key: m[1], value: m[2].trim() })
  }
  return pairs
}

export function SkillView() {
  const activeSession = useActiveSession()
  const { activeSessionId, updateSession } = useSessionStore()
  const { skillGenerateState, setSkillGenerateState, setActiveTab } = useUIStore()
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [showRaw, setShowRaw] = useState(false)

  const events = activeSession?.events ?? []
  const meta = activeSession?.meta ?? null
  const skillMarkdown = activeSession?.skillMarkdown ?? ''
  const skillRawOutput = activeSession?.skillRawOutput ?? ''

  const hasEvents = events.length > 0
  const isGenerating = skillGenerateState === 'generating'

  // Reset showRaw when active session changes
  useEffect(() => { setShowRaw(false); setIsEditing(false) }, [activeSessionId])

  const GENERATING_MESSAGES = [
    '正在分析录制的操作序列…',
    '构建 Skill 结构…',
    '优化步骤表述…',
    '整理输出格式…',
    '即将完成，稍等…',
  ]
  const [msgIdx, setMsgIdx] = useState(0)

  useEffect(() => {
    if (!isGenerating) { setMsgIdx(0); return }
    const lastIdx = GENERATING_MESSAGES.length - 1
    const timer = setInterval(() => {
      setMsgIdx((i) => {
        if (i >= lastIdx) { clearInterval(timer); return lastIdx }
        return i + 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [isGenerating])

  const frontMatter = useMemo(() => {
    if (!skillMarkdown || isEditing || isGenerating) return null
    return splitFrontMatter(skillMarkdown)
  }, [skillMarkdown, isEditing, isGenerating])

  const bodyContent = frontMatter ? frontMatter.body : skillMarkdown

  const handleGenerate = async () => {
    if (!meta || !activeSessionId) return
    setIsEditing(false)
    setErrorMessage('')
    setSkillGenerateState('generating')
    try {
      const { normalized, raw } = await generateSkill(events, meta)
      updateSession(activeSessionId, { skillMarkdown: normalized, skillRawOutput: raw })
      setSkillGenerateState('done')
      setActiveTab('skill')
    } catch (error) {
      console.error('生成 Skill 失败:', error)
      setErrorMessage(getErrorMessage(error))
      setSkillGenerateState('error')
    }
  }

  const handleEdit = () => {
    setEditValue(skillMarkdown)
    setIsEditing(true)
  }

  const handleSaveEdit = () => {
    if (activeSessionId) updateSession(activeSessionId, { skillMarkdown: editValue, skillRawOutput: editValue })
    setIsEditing(false)
  }

  if (!activeSession) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>◎</div>
        <p className={styles.emptyTitle}>未选择录制</p>
        <p className={styles.emptyHint}>从左侧选择一条录制，或点击「开始录制」新建。</p>
      </div>
    )
  }

  if (!hasEvents) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>◎</div>
        <p className={styles.emptyTitle}>暂无录制数据</p>
        <p className={styles.emptyHint}>先录制一段浏览器工作流，然后点击「生成 Skill」创建可复用的技能文档。</p>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          {isGenerating ? (
            <>
              <span className={styles.toolbarLabel}>skill.md</span>
              <span className={styles.statusDotPending} />
              <span className={styles.statusTextPending}>正在生成</span>
            </>
          ) : skillMarkdown ? (
            <>
              <span className={styles.toolbarLabel}>skill.md</span>
              <span className={styles.statusDot} />
              <span className={styles.statusText}>已生成</span>
            </>
          ) : (
            <span className={styles.toolbarLabel}>尚未生成 Skill</span>
          )}
        </div>
        <div className={styles.toolbarRight}>
          {skillMarkdown && !isEditing && !isGenerating && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setShowRaw((v) => !v)}>
                {showRaw ? '渲染视图' : '原始输出'}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleEdit}>编辑</Button>
            </>
          )}
          {isEditing && !isGenerating && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>取消</Button>
              <Button variant="primary" size="sm" onClick={handleSaveEdit}>保存</Button>
            </>
          )}
          <Button
            variant={skillMarkdown ? 'secondary' : 'primary'}
            size="sm"
            disabled={isGenerating || !hasEvents}
            onClick={handleGenerate}
          >
            {isGenerating ? '生成中…' : skillMarkdown ? '重新生成' : '生成 Skill'}
          </Button>
        </div>
      </div>

      {errorMessage && !isGenerating && (
        <div className={styles.errorMessage}>{errorMessage}</div>
      )}

      {!skillMarkdown && !isGenerating && (
        <div className={styles.generatePrompt}>
          <div className={styles.promptIcon}>✦</div>
          <p className={styles.promptText}>
            已录制 {events.length} 个事件。点击 <strong>生成 Skill</strong> 创建可复用的技能文档。
          </p>
        </div>
      )}

      {isGenerating && (
        <div className={styles.generating}>
          <img src={loadingSvg} className={styles.generatingSpinner} aria-hidden="true" />
          <span className={styles.generatingMsg}>{GENERATING_MESSAGES[msgIdx]}</span>
        </div>
      )}

      {skillMarkdown && !isGenerating && (
        isEditing ? (
          <div className={styles.editor}>
            <textarea className={styles.textarea} value={editValue} onChange={(e) => setEditValue(e.target.value)} spellCheck={false} />
          </div>
        ) : showRaw ? (
          <div className={styles.editor}>
            <textarea className={styles.textarea} value={skillRawOutput} readOnly spellCheck={false} />
          </div>
        ) : (
          <div className={styles.rendered}>
            {frontMatter && (
              <div className={styles.frontMatter}>
                <div className={styles.frontMatterTag}>YAML</div>
                <div className={styles.frontMatterFields}>
                  {parseYamlPairs(frontMatter.yaml).map(({ key, value }) => (
                    <div key={key} className={styles.frontMatterField}>
                      <span className={styles.frontMatterKey}>{key}</span>
                      <span className={styles.frontMatterValue}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {bodyContent && <MarkdownRenderer content={bodyContent} />}
          </div>
        )
      )}
    </div>
  )
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message) return message
  }
  return '生成失败，请检查 Coze 工作流配置或网络状态。'
}
