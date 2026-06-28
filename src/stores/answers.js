import { defineStore } from 'pinia'
import { v4 as uuid } from 'uuid'
import { AnswerDB } from '../utils/db'
import { parseVariables } from '../utils/variables'
import { buildSearch, searchAnswers } from '../utils/search'

export const useAnswersStore = defineStore('answers', {
  state: () => ({
    list: [],
    filtered: [],
    query: ''
  }),
  actions: {
    init() {
      const items = AnswerDB.getAll()
      if (!items.length) {
        const seed = {
          _id: `ans_${uuid()}`,
          type: 'answer',
          title: '退款申请流程',
          categoryId: 'cat_default',
          tags: ['退款', '售后'],
          content:
            '您好 {{客户姓名}}，您的退款已提交成功，预计 1-3 个工作日到账。如需查询请提供订单号 {{订单号}}。',
          variables: ['客户姓名', '订单号'],
          images: [],
          useCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        AnswerDB.save(seed)
      }
      this.reload()
    },
    reload() {
      this.list = AnswerDB.getAll().sort((a, b) => {
        const ao = Number.isFinite(a.order) ? a.order : Number.MAX_SAFE_INTEGER
        const bo = Number.isFinite(b.order) ? b.order : Number.MAX_SAFE_INTEGER
        if (ao !== bo) return ao - bo
        return String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
      })
      buildSearch(this.list)
      this.filtered = searchAnswers(this.list, this.query)
    },
    setQuery(query) {
      this.query = query
      this.filtered = searchAnswers(this.list, query)
    },
    saveAnswer(answer) {
      const payload = {
        ...answer,
        type: 'answer',
        variables: parseVariables(answer.content || ''),
        updatedAt: new Date().toISOString()
      }
      if (!payload._id) {
        payload._id = `ans_${uuid()}`
        payload.createdAt = new Date().toISOString()
        payload.useCount = 0
        const maxOrder = this.list.reduce((max, item) => {
          const order = Number.isFinite(item.order) ? item.order : -1
          return Math.max(max, order)
        }, -1)
        payload.order = maxOrder + 1
      }
      AnswerDB.save(payload)
      this.reload()
    },
    removeAnswer(id) {
      AnswerDB.remove(id)
      this.reload()
    },
    removeAnswers(ids = []) {
      const targetIds = new Set(ids)
      this.list.forEach((item) => {
        if (targetIds.has(item._id)) {
          AnswerDB.remove(item._id)
        }
      })
      this.reload()
    },
    incrementUseCount(id) {
      AnswerDB.incrementUseCount(id)
      // Patch in-memory only — avoids rebuilding the Fuse.js index on every copy
      const item = this.list.find((a) => a._id === id)
      if (item) {
        item.useCount = (item.useCount || 0) + 1
        const filteredItem = this.filtered.find((a) => a._id === id)
        if (filteredItem) filteredItem.useCount = item.useCount
      }
    },
    bulkUpdateCategory(ids = [], categoryId = '') {
      if (!categoryId) return 0
      const targetIds = new Set(ids)
      let count = 0
      this.list.forEach((item) => {
        if (targetIds.has(item._id)) {
          AnswerDB.save({
            ...item,
            categoryId,
            updatedAt: new Date().toISOString()
          })
          count += 1
        }
      })
      this.reload()
      return count
    },
    bulkAddTags(ids = [], tags = []) {
      const cleanedTags = Array.from(new Set(tags.map((tag) => String(tag || '').trim()).filter(Boolean)))
      if (!cleanedTags.length) return 0

      const targetIds = new Set(ids)
      let count = 0
      this.list.forEach((item) => {
        if (targetIds.has(item._id)) {
          const nextTags = Array.from(new Set([...(item.tags || []), ...cleanedTags]))
          AnswerDB.save({
            ...item,
            tags: nextTags,
            updatedAt: new Date().toISOString()
          })
          count += 1
        }
      })
      this.reload()
      return count
    },
    bulkRemoveTags(ids = [], tags = []) {
      const tagSet = new Set(tags.map((tag) => String(tag || '').trim()).filter(Boolean))
      if (!tagSet.size) return 0

      const targetIds = new Set(ids)
      let count = 0
      this.list.forEach((item) => {
        if (targetIds.has(item._id)) {
          const nextTags = (item.tags || []).filter((tag) => !tagSet.has(tag))
          AnswerDB.save({
            ...item,
            tags: nextTags,
            updatedAt: new Date().toISOString()
          })
          count += 1
        }
      })
      this.reload()
      return count
    },
    duplicateAnswers(ids = []) {
      const targetIds = new Set(ids)
      let count = 0
      this.list.forEach((item) => {
        if (targetIds.has(item._id)) {
          const now = new Date().toISOString()
          AnswerDB.save({
            ...item,
            _id: `ans_${uuid()}`,
            title: `${item.title}（副本）`,
            useCount: 0,
            createdAt: now,
            updatedAt: now
          })
          count += 1
        }
      })
      this.reload()
      return count
    },
    moveAnswerToCategory(answerId, toCategoryId) {
      const item = this.list.find((ans) => ans._id === answerId)
      if (!item) return { ok: false, message: '回复不存在' }
      if (!toCategoryId) return { ok: false, message: '目标分类无效' }

      AnswerDB.save({
        ...item,
        categoryId: toCategoryId,
        updatedAt: new Date().toISOString()
      })
      this.reload()
      return { ok: true }
    },
    reorderAnswerByFiltered(sourceId, targetId, filteredIds = []) {
      const idList = Array.isArray(filteredIds) ? filteredIds : []
      const sourceIndex = idList.indexOf(sourceId)
      const targetIndex = idList.indexOf(targetId)
      if (sourceIndex < 0 || targetIndex < 0) return { ok: false, message: '目标不在当前列表中' }

      const ordered = [...idList]
      ordered.splice(sourceIndex, 1)
      const nextTargetIndex = ordered.indexOf(targetId)
      ordered.splice(nextTargetIndex, 0, sourceId)

      ordered.forEach((id, index) => {
        const item = this.list.find((ans) => ans._id === id)
        if (!item) return
        AnswerDB.save({
          ...item,
          order: index,
          updatedAt: new Date().toISOString()
        })
      })

      this.reload()
      return { ok: true }
    },
    moveAnswersToCategory(fromCategoryId, toCategoryId) {
      const affected = this.list.filter((item) => item.categoryId === fromCategoryId)
      affected.forEach((item) => {
        AnswerDB.save({
          ...item,
          categoryId: toCategoryId,
          updatedAt: new Date().toISOString()
        })
      })
      this.reload()
      return affected.length
    },
    exportAll() {
      return this.list.map((item) => ({ ...item, images: Array.isArray(item.images) ? [...item.images] : [] }))
    },
    replaceAll(items = []) {
      const db = window.preload?.db
      const all = db?.allDocs?.('ans_') || []
      all.forEach((row) => {
        const doc = row && typeof row === 'object' && 'doc' in row ? row.doc : row
        if (doc?._id) {
          db?.remove?.(doc._id)
        }
      })

      items.forEach((item, index) => {
        AnswerDB.save({
          ...item,
          _id: item._id || `ans_${uuid()}`,
          type: 'answer',
          order: Number.isFinite(item.order) ? item.order : index,
          updatedAt: new Date().toISOString()
        })
      })

      this.reload()
    },
    mergeAll(items = []) {
      items.forEach((item, index) => {
        AnswerDB.save({
          ...item,
          _id: item._id || `ans_${uuid()}`,
          type: 'answer',
          order: Number.isFinite(item.order) ? item.order : this.list.length + index,
          updatedAt: new Date().toISOString()
        })
      })
      this.reload()
    }
  }
})
