import { ipcRenderer } from 'electron'

type RecorderCommand = 'START' | 'STOP' | 'PAUSE' | 'RESUME'

;(function () {
  if ((window as Window & { __browserRecorderInjected?: boolean }).__browserRecorderInjected) return
  ;(window as Window & { __browserRecorderInjected?: boolean }).__browserRecorderInjected = true

  let isRecording = false
  let startTime = Date.now()
  let lastUrl = location.href
  let scrollTimer: ReturnType<typeof setTimeout> | null = null

  function generateId() {
    return Date.now() + '-' + Math.random().toString(36).slice(2, 8)
  }

  function getSelector(el: Element | null): string {
    if (!el) return ''
    if (el.id && /^[a-zA-Z][\w-]*$/.test(el.id)) return '#' + el.id
    const parts: string[] = []
    let cur: Element | null = el

    while (cur && cur !== document.body && parts.length < 5) {
      const tag = cur.tagName.toLowerCase()
      let selector = tag
      const parent = cur.parentElement

      if (parent) {
        const siblings = Array.from(parent.children).filter((child) => child.tagName === cur?.tagName)
        if (siblings.length > 1) selector += `:nth-of-type(${siblings.indexOf(cur) + 1})`
      }

      parts.unshift(selector)
      cur = cur.parentElement

      try {
        if (document.querySelectorAll(parts.join(' > ')).length === 1) break
      } catch {
        break
      }
    }

    return parts.join(' > ')
  }

  function getTarget(target: EventTarget | null) {
    if (!target || !(target instanceof Element)) return undefined
    const rect = target.getBoundingClientRect()
    const input = target as HTMLInputElement

    return {
      tagName: target.tagName,
      id: (target as HTMLElement).id || undefined,
      className: typeof (target as HTMLElement).className === 'string'
        ? (target as HTMLElement).className.slice(0, 80)
        : undefined,
      textContent: (target.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100) || undefined,
      placeholder: input.placeholder || undefined,
      ariaLabel: target.getAttribute('aria-label') || undefined,
      role: target.getAttribute('role') || undefined,
      cssSelector: getSelector(target),
      inputType: input.type || undefined,
      isPassword: input.type === 'password',
      boundingRect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
    }
  }

  function emit(type: string, target: ReturnType<typeof getTarget>, data: Record<string, unknown> = {}) {
    ipcRenderer.send('browser-recorder-event', {
      id: generateId(),
      timestamp: Date.now(),
      relativeTime: Date.now() - startTime,
      type,
      tabId: 0,
      tabTitle: document.title,
      tabUrl: location.href,
      target,
      data,
    })
  }

  const onClick = (event: MouseEvent) => {
    if (isRecording) emit('click', getTarget(event.target))
  }

  const onDblClick = (event: MouseEvent) => {
    if (isRecording) emit('dblclick', getTarget(event.target))
  }

  const onInput = (event: Event) => {
    if (!isRecording) return
    const input = event.target as HTMLInputElement
    emit('input', getTarget(input), { value: input.type === 'password' ? '***' : input.value || '' })
  }

  const onChange = (event: Event) => {
    if (!isRecording) return
    const input = event.target as HTMLInputElement
    emit('change', getTarget(input), { value: input.type === 'password' ? '***' : input.value || '' })
  }

  const onKeydown = (event: KeyboardEvent) => {
    if (!isRecording) return
    const special = ['Enter', 'Escape', 'Tab', 'Backspace', 'Delete', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
    if (!event.ctrlKey && !event.metaKey && !event.altKey && !special.includes(event.key)) return
    emit('keydown', getTarget(event.target), {
      key: event.key,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
    })
  }

  const onScroll = () => {
    if (!isRecording) return
    if (scrollTimer) clearTimeout(scrollTimer)
    scrollTimer = setTimeout(() => {
      emit('scroll', undefined, { scrollX: window.scrollX, scrollY: window.scrollY })
    }, 300)
  }

  const onCopy = (event: ClipboardEvent) => {
    if (isRecording) emit('copy', getTarget(event.target), { clipboardText: (window.getSelection()?.toString() ?? '').slice(0, 200) })
  }

  const onPaste = (event: ClipboardEvent) => {
    if (isRecording) emit('paste', getTarget(event.target), { clipboardText: (event.clipboardData?.getData('text/plain') ?? '').slice(0, 200) })
  }

  function checkNavigation() {
    const currentUrl = location.href
    if (currentUrl === lastUrl) return
    if (isRecording) emit('navigation', undefined, { fromUrl: lastUrl, toUrl: currentUrl })
    lastUrl = currentUrl
  }

  const originalPushState = history.pushState.bind(history)
  const originalReplaceState = history.replaceState.bind(history)
  history.pushState = (...args: Parameters<typeof history.pushState>) => {
    originalPushState(...args)
    checkNavigation()
  }
  history.replaceState = (...args: Parameters<typeof history.replaceState>) => {
    originalReplaceState(...args)
    checkNavigation()
  }

  function attach() {
    document.addEventListener('click', onClick, true)
    document.addEventListener('dblclick', onDblClick, true)
    document.addEventListener('input', onInput, true)
    document.addEventListener('change', onChange, true)
    document.addEventListener('keydown', onKeydown, true)
    document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    document.addEventListener('copy', onCopy, true)
    document.addEventListener('paste', onPaste, true)
    window.addEventListener('popstate', checkNavigation)
    window.addEventListener('hashchange', checkNavigation)
  }

  function detach() {
    document.removeEventListener('click', onClick, true)
    document.removeEventListener('dblclick', onDblClick, true)
    document.removeEventListener('input', onInput, true)
    document.removeEventListener('change', onChange, true)
    document.removeEventListener('keydown', onKeydown, true)
    document.removeEventListener('scroll', onScroll, true)
    document.removeEventListener('copy', onCopy, true)
    document.removeEventListener('paste', onPaste, true)
    window.removeEventListener('popstate', checkNavigation)
    window.removeEventListener('hashchange', checkNavigation)
  }

  ipcRenderer.on(
    'browser-recorder-command',
    (_event, payload: { cmd: RecorderCommand; startTime?: number }) => {
      if (payload.cmd === 'START') {
        isRecording = true
        startTime = payload.startTime || Date.now()
        lastUrl = location.href
        attach()
      } else if (payload.cmd === 'STOP' || payload.cmd === 'PAUSE') {
        isRecording = false
        detach()
      } else if (payload.cmd === 'RESUME') {
        isRecording = true
        attach()
      }
    }
  )

  ipcRenderer.send('browser-recorder-ready')
})()
