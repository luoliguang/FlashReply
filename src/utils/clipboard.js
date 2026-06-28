import { fillVariables } from './variables'
import { useAnswersStore } from '../stores/answers'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function copyImage(dataUrl) {
  if (window.utools?.copyImage) {
    const ok = window.utools.copyImage(dataUrl)
    if (!ok) throw new Error('图片复制失败')
    return
  }

  const res = await fetch(dataUrl)
  const blob = await res.blob()
  await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
}

export async function copyFlow(answer, vars = {}) {
  const store = useAnswersStore()
  const finalText = fillVariables(answer.content || '', vars)

  if (window.utools?.copyText) {
    const ok = window.utools.copyText(finalText)
    if (!ok) throw new Error('复制失败')
  } else {
    await navigator.clipboard.writeText(finalText)
  }

  store.incrementUseCount(answer._id)
  return finalText
}

async function fallbackToCopy(finalText) {
  if (window.utools?.copyText) {
    const copied = window.utools.copyText(finalText)
    if (copied) return { mode: 'copy', message: '已复制到剪贴板，请在目标输入框按 Ctrl+V' }
  }

  await navigator.clipboard.writeText(finalText)
  return { mode: 'copy', message: '已复制到剪贴板，请在目标输入框按 Ctrl+V' }
}

export async function insertFlow(answer, vars = {}, strategy = 'copy') {
  const finalText = fillVariables(answer.content || '', vars)
  const preload = window.preload

  // 置顶策略：不隐藏插件，仅复制，用户手动粘贴
  if (strategy === 'copy') {
    return await fallbackToCopy(finalText)
  }

  // 自动插入策略：先隐藏窗口，给目标输入框恢复焦点时间
  preload?.hideMainWindow?.()
  await sleep(220)

  // 官方 API：隐藏窗口并粘贴（再次尝试，提升命中率）
  if (typeof preload?.hideMainWindowPasteText === 'function') {
    const ok = preload.hideMainWindowPasteText(finalText)
    if (ok) return { mode: 'insert', message: '已插入到当前窗口' }

    await sleep(140)
    const retryOk = preload.hideMainWindowPasteText(finalText)
    if (retryOk) return { mode: 'insert', message: '已插入到当前窗口' }
  }

  // 兜底方案：复制 + 模拟粘贴热键
  const copied = preload?.copyText?.(finalText) ?? window.utools?.copyText?.(finalText)
  if (copied) {
    await sleep(120)
    const simulated = preload?.simulatePasteHotkey?.()
    if (simulated) return { mode: 'insert', message: '已插入到当前窗口' }
  }

  return {
    mode: 'copy',
    message: '自动插入失败：可能未命中输入焦点，已复制到剪贴板，请手动粘贴'
  }
}
