import { defineStore } from 'pinia'
import { v4 as uuid } from 'uuid'
import { CategoryDB } from '../utils/db'

const CATEGORY_MAX_LENGTH = 20

function validateCategoryName(name) {
  const finalName = String(name || '').trim()
  if (!finalName) return { ok: false, message: '分类名称不能为空' }
  if (finalName.length > CATEGORY_MAX_LENGTH) {
    return { ok: false, message: `分类名称不能超过 ${CATEGORY_MAX_LENGTH} 个字符` }
  }
  if (!/[\u4e00-\u9fa5a-zA-Z0-9]/.test(finalName)) {
    return { ok: false, message: '分类名称需包含文字或数字' }
  }
  return { ok: true, value: finalName }
}

function normalizeInput(input) {
  if (typeof input === 'string') {
    return { name: input, parentId: '' }
  }
  return {
    name: input?.name || '',
    parentId: input?.parentId || ''
  }
}

export const useCategoriesStore = defineStore('categories', {
  state: () => ({
    list: [],
    currentId: 'all'
  }),
  getters: {
    level1List(state) {
      return state.list.filter((c) => !c.parentId)
    },
    flattened(state) {
      const top = state.list.filter((c) => !c.parentId)
      const children = (id) => state.list.filter((c) => c.parentId === id)
      const result = []
      top.forEach((cat) => {
        result.push({ ...cat, level: 1 })
        children(cat._id).forEach((sub) => {
          result.push({ ...sub, level: 2 })
        })
      })
      return result
    }
  },
  actions: {
    init() {
      const cats = CategoryDB.getAll()
      if (!cats.length) {
        CategoryDB.save({
          _id: `cat_${uuid()}`,
          type: 'category',
          name: '未分类',
          icon: '📁',
          parentId: '',
          order: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
      }
      this.reload()
    },
    reload() {
      const raw = CategoryDB.getAll().map((c) => ({ ...c, parentId: c.parentId || '' }))
      const sorted = raw.sort((a, b) => {
        if (a.parentId !== b.parentId) {
          return String(a.parentId).localeCompare(String(b.parentId))
        }
        return (a.order || 0) - (b.order || 0)
      })
      this.list = sorted

      if (this.currentId !== 'all' && !this.list.some((c) => c._id === this.currentId)) {
        this.currentId = 'all'
      }
    },
    setCurrent(id) {
      this.currentId = id
    },
    getBranchIds(id) {
      if (!id || id === 'all') return this.list.map((c) => c._id)
      const branch = [id]
      this.list.forEach((c) => {
        if (c.parentId === id) {
          branch.push(c._id)
        }
      })
      return branch
    },
    getFallbackCategoryId() {
      const fallback = this.list.find((c) => c.name === '未分类' && !c.parentId) || this.list[0]
      return fallback?._id || null
    },
    addCategory(input) {
      const normalized = normalizeInput(input)
      const valid = validateCategoryName(normalized.name)
      if (!valid.ok) return { ok: false, message: valid.message }
      const finalName = valid.value
      const parentId = normalized.parentId || ''

      if (parentId) {
        const parent = this.list.find((c) => c._id === parentId)
        if (!parent) return { ok: false, message: '上级分类不存在' }
        if (parent.parentId) return { ok: false, message: '仅支持二级文件夹' }
      }

      const exists = this.list.some((c) => c.parentId === parentId && c.name === finalName)
      if (exists) return { ok: false, message: '同级分类已存在' }

      const order = this.list.filter((c) => (c.parentId || '') === parentId).length
      const doc = {
        _id: `cat_${uuid()}`,
        type: 'category',
        name: finalName,
        icon: parentId ? '📂' : '📁',
        parentId,
        order,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      CategoryDB.save(doc)
      this.reload()
      return { ok: true, data: doc }
    },
    renameCategory(id, name) {
      const valid = validateCategoryName(name)
      if (!valid.ok) return { ok: false, message: valid.message }
      const finalName = valid.value

      const target = this.list.find((c) => c._id === id)
      if (!target) return { ok: false, message: '分类不存在' }

      const exists = this.list.some(
        (c) => c._id !== id && (c.parentId || '') === (target.parentId || '') && c.name === finalName
      )
      if (exists) return { ok: false, message: '同级分类名称已存在' }

      const doc = {
        ...target,
        name: finalName,
        updatedAt: new Date().toISOString()
      }
      CategoryDB.save(doc)
      this.reload()
      return { ok: true, data: doc }
    },
    moveCategory(id, direction) {
      const source = this.list.find((c) => c._id === id)
      if (!source) return { ok: false, message: '分类不存在' }

      const siblings = this.list
        .filter((c) => (c.parentId || '') === (source.parentId || ''))
        .sort((a, b) => (a.order || 0) - (b.order || 0))

      const idx = siblings.findIndex((c) => c._id === id)
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= siblings.length) {
        return { ok: false, message: '已到边界，无法继续移动' }
      }

      const target = siblings[swapIdx]
      CategoryDB.save({ ...source, order: swapIdx, updatedAt: new Date().toISOString() })
      CategoryDB.save({ ...target, order: idx, updatedAt: new Date().toISOString() })
      this.reload()
      return { ok: true }
    },
    moveCategoryByDrop(dragId, targetId, mode = 'after') {
      const drag = this.list.find((c) => c._id === dragId)
      const target = this.list.find((c) => c._id === targetId)
      if (!drag || !target) return { ok: false, message: '分类不存在' }
      if (dragId === targetId) return { ok: false, message: '不能拖拽到自身' }

      const hasChildren = this.list.some((c) => c.parentId === dragId)

      if (mode === 'inside') {
        if (target.parentId) return { ok: false, message: '仅可拖入一级分类' }
        if (hasChildren) return { ok: false, message: '包含子分类的一级分类不可拖入' }

        const sameLevelNameExists = this.list.some(
          (c) => c._id !== dragId && c.parentId === target._id && c.name === drag.name
        )
        if (sameLevelNameExists) return { ok: false, message: '目标分类下有同名分类' }

        const childSiblings = this.list
          .filter((c) => c.parentId === target._id && c._id !== dragId)
          .sort((a, b) => (a.order || 0) - (b.order || 0))

        CategoryDB.save({
          ...drag,
          parentId: target._id,
          icon: '📂',
          order: childSiblings.length,
          updatedAt: new Date().toISOString()
        })

        this.reload()
        return { ok: true }
      }

      const nextParentId = target.parentId || ''
      if (hasChildren && nextParentId) {
        return { ok: false, message: '包含子分类的一级分类不可降级为二级' }
      }

      const sameLevelNameExists = this.list.some(
        (c) => c._id !== dragId && (c.parentId || '') === nextParentId && c.name === drag.name
      )
      if (sameLevelNameExists && drag.parentId !== nextParentId) {
        return { ok: false, message: '目标位置存在同名分类' }
      }

      const siblings = this.list
        .filter((c) => (c.parentId || '') === nextParentId && c._id !== dragId)
        .sort((a, b) => (a.order || 0) - (b.order || 0))

      const targetIdx = siblings.findIndex((c) => c._id === targetId)
      const insertIdx = targetIdx < 0 ? siblings.length : targetIdx + 1
      const next = [...siblings]
      next.splice(insertIdx, 0, { ...drag, parentId: nextParentId })

      next.forEach((cat, index) => {
        const isDrag = cat._id === dragId
        CategoryDB.save({
          ...cat,
          parentId: cat.parentId || '',
          icon: (cat.parentId || '') ? '📂' : '📁',
          order: index,
          updatedAt: new Date().toISOString(),
          ...(isDrag ? { parentId: nextParentId } : {})
        })
      })

      this.reload()
      return { ok: true }
    },
    removeCategory(id) {
      const target = this.list.find((c) => c._id === id)
      if (!target) return { ok: false, message: '分类不存在' }
      if (target.name === '未分类') return { ok: false, message: '未分类不可删除' }

      const hasChildren = this.list.some((c) => c.parentId === id)
      if (hasChildren) return { ok: false, message: '请先删除二级分类' }

      CategoryDB.remove(id)
      this.reload()

      const siblings = this.list
        .filter((c) => (c.parentId || '') === (target.parentId || ''))
        .sort((a, b) => (a.order || 0) - (b.order || 0))

      siblings.forEach((cat, index) => {
        if ((cat.order || 0) !== index) {
          CategoryDB.save({ ...cat, order: index, updatedAt: new Date().toISOString() })
        }
      })

      this.reload()
      return { ok: true, data: target }
    },
    exportAll() {
      return this.list.map((cat) => ({ ...cat }))
    },
    replaceAll(items = []) {
      const db = window.preload?.db
      const all = db?.allDocs?.('cat_') || []
      all.forEach((row) => {
        const doc = row && typeof row === 'object' && 'doc' in row ? row.doc : row
        if (doc?._id) {
          db?.remove?.(doc._id)
        }
      })

      items.forEach((cat, index) => {
        CategoryDB.save({
          ...cat,
          _id: cat._id || `cat_${uuid()}`,
          type: 'category',
          parentId: cat.parentId || '',
          icon: cat.parentId ? '📂' : '📁',
          order: Number.isFinite(cat.order) ? cat.order : index,
          updatedAt: new Date().toISOString()
        })
      })

      if (!items.length) {
        CategoryDB.save({
          _id: `cat_${uuid()}`,
          type: 'category',
          name: '未分类',
          icon: '📁',
          parentId: '',
          order: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
      }

      this.reload()
    },
    mergeAll(items = []) {
      items.forEach((cat, index) => {
        CategoryDB.save({
          ...cat,
          _id: cat._id || `cat_${uuid()}`,
          type: 'category',
          parentId: cat.parentId || '',
          icon: cat.parentId ? '📂' : '📁',
          order: Number.isFinite(cat.order) ? cat.order : this.list.length + index,
          updatedAt: new Date().toISOString()
        })
      })
      this.reload()
    }
  }
})
