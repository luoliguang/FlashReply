if (!window.preload) {
  const STORAGE_KEY = '__quick_reply_mock_db__'
  const raw = localStorage.getItem(STORAGE_KEY)
  const store = raw ? JSON.parse(raw) : {}

  const persist = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(store))

  window.preload = {
    db: {
      get: (id) => store[id] || null,
      put: (doc) => {
        store[doc._id] = doc
        persist()
        return doc
      },
      remove: (id) => {
        delete store[id]
        persist()
        return true
      },
      allDocs: (prefix) =>
        Object.values(store)
          .filter((d) => d?._id?.startsWith(prefix))
          .map((doc) => ({ doc }))
    },
    hideMainWindow: () => {},
    showMainWindow: () => {},
    isDev: () => true
  }
}
