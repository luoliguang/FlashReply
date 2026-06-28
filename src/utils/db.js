const IMAGE_PREFIX = 'img_'

function toPlainObject(value) {
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return value
  }
}

export const AnswerDB = {
  getAll: () => {
    const db = window.preload?.db
    if (!db?.allDocs) return []

    const rows = db.allDocs('ans_') || []
    const answers = rows
      .map((r) => (r && typeof r === 'object' && 'doc' in r ? r.doc : r))
      .filter((ans) => ans && typeof ans === 'object')

    return answers.map((ans) => {
      const imageRefs = Array.isArray(ans.imageRefs) ? ans.imageRefs : []
      const images = imageRefs
        .map((id) => db.get?.(id))
        .filter(Boolean)
        .map((doc) => ({ id: doc._id, name: doc.name, dataUrl: doc.dataUrl }))
      return {
        ...ans,
        images
      }
    })
  },
  get: (id) => window.preload?.db?.get?.(id),
  save: (answer) => {
    const db = window.preload?.db
    if (!db?.put) return null

    const plainAnswer = toPlainObject(answer) || {}

    const imageRefs = []
    const images = Array.isArray(plainAnswer.images) ? plainAnswer.images : []

    images.forEach((img) => {
      const imageId = img.id?.startsWith(IMAGE_PREFIX) ? img.id : `${IMAGE_PREFIX}${img.id || Date.now()}`
      const imageDoc = toPlainObject({
        _id: imageId,
        type: 'image',
        answerId: plainAnswer._id,
        name: img.name || 'image',
        dataUrl: img.dataUrl,
        updatedAt: new Date().toISOString()
      })
      db.put(imageDoc)
      imageRefs.push(imageId)
    })

    const answerDoc = toPlainObject({
      ...plainAnswer,
      images: undefined,
      imageRefs,
      updatedAt: new Date().toISOString()
    })

    return db.put(answerDoc)
  },
  remove: (id) => {
    const db = window.preload?.db
    if (!db?.remove || !db?.get) return null

    const doc = db.get(id)
    const refs = Array.isArray(doc?.imageRefs) ? doc.imageRefs : []
    refs.forEach((imageId) => db.remove(imageId))

    return db.remove(id)
  },
  incrementUseCount: (id) => {
    const db = window.preload?.db
    if (!db?.get || !db?.put) return null
    const doc = db.get(id)
    if (!doc) return null
    return db.put({
      ...doc,
      useCount: (doc.useCount || 0) + 1,
      updatedAt: new Date().toISOString()
    })
  }
}

export const CategoryDB = {
  getAll: () => {
    const db = window.preload?.db
    if (!db?.allDocs) return []

    const rows = db.allDocs('cat_') || []
    return rows
      .map((r) => (r && typeof r === 'object' && 'doc' in r ? r.doc : r))
      .filter((cat) => cat && typeof cat === 'object')
  },
  save: (cat) => {
    const db = window.preload?.db
    if (!db?.put) return null
    return db.put(cat)
  },
  remove: (id) => {
    const db = window.preload?.db
    if (!db?.remove) return null
    return db.remove(id)
  }
}
