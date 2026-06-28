const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('preload', {
  db: {
    get: (id) => utools.db.get(id),
    put: (doc) => utools.db.put(doc),
    remove: (id) => {
      const doc = utools.db.get(id)
      if (doc) return utools.db.remove(doc._id)
      return null
    },
    allDocs: (prefix) => utools.db.allDocs(prefix)
  },
  hideMainWindow: () => utools.hideMainWindow(),
  showMainWindow: () => utools.showMainWindow(),
  hideMainWindowPasteText: (text) => utools.hideMainWindowPasteText(text),
  isWindows: () => utools.isWindows(),
  isMacOS: () => utools.isMacOS(),
  isDev: () => utools.isDev(),
  notify: (text) => utools.showNotification(text)
})
