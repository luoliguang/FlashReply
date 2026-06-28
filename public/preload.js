// uTools preload（在渲染进程预加载）
// 这里直接挂到 window.preload，兼容当前 uTools 环境。

window.preload = {
  db: {
    get: (id) => utools.db.get(id),
    put: (doc) => utools.db.put(doc),
    remove: (id) => {
      const doc = utools.db.get(id)
      if (doc) return utools.db.remove(doc)
      return null
    },
    allDocs: (prefix) => utools.db.allDocs(prefix)
  },
  hideMainWindow: () => utools.hideMainWindow(),
  showMainWindow: () => utools.showMainWindow(),
  hideMainWindowPasteText: (text) => {
    if (typeof utools.hideMainWindowPasteText === 'function') {
      return utools.hideMainWindowPasteText(text)
    }
    return false
  },
  copyText: (text) => utools.copyText(text),
  simulatePasteHotkey: () => {
    if (utools.isMacOS()) {
      utools.simulateKeyboardTap('v', 'command')
      return true
    }
    if (utools.isWindows()) {
      utools.simulateKeyboardTap('v', 'ctrl')
      return true
    }
    return false
  },
  isWindows: () => utools.isWindows(),
  isMacOS: () => utools.isMacOS(),
  isDev: () => utools.isDev(),
  notify: (text) => utools.showNotification(text)
}
