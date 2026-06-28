<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAnswersStore } from '../stores/answers'
import { useCategoriesStore } from '../stores/categories'
import AnswerEditor from '../components/AnswerEditor.vue'
import CategorySidebar from '../components/CategorySidebar.vue'

const router = useRouter()
const route = useRoute()
const answersStore = useAnswersStore()
const categoriesStore = useCategoriesStore()

const showEditor = ref(false)
const editing = ref(null)
const searchText = ref('')
const filterCategoryId = ref('all')
const selectedIds = ref([])
const batchCategoryId = ref('')
const batchTagInput = ref('')
const toast = ref({ show: false, text: '', type: 'success' })
const adminSidebarWidth = ref(280)
const importFileRef = ref(null)
const importDialog = ref(false)
const importStrategy = ref('preview')
const importPayload = ref({ categories: [], answers: [], fileName: '' })
const importStats = ref({
  categoryNew: 0,
  categoryOverwrite: 0,
  answerNew: 0,
  answerOverwrite: 0
})

let toastTimer = null

function showToast(text, type = 'success') {
  toast.value = { show: true, text, type }
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value.show = false
  }, 1600)
}

const allCategoryOptions = computed(() => categoriesStore.flattened)

const filteredList = computed(() => {
  const keyword = searchText.value.trim().toLowerCase()
  const branchIds = new Set(categoriesStore.getBranchIds(filterCategoryId.value))

  return answersStore.list.filter((item) => {
    const byCategory = filterCategoryId.value === 'all' ? true : branchIds.has(item.categoryId)
    if (!byCategory) return false

    if (!keyword) return true

    const categoryName = categoriesStore.list.find((c) => c._id === item.categoryId)?.name || ''
    const haystack = [item.title || '', item.content || '', (item.tags || []).join(' '), categoryName].join(' ')
    return haystack.toLowerCase().includes(keyword)
  })
})

const allChecked = computed(
  () => filteredList.value.length > 0 && filteredList.value.every((item) => selectedIds.value.includes(item._id))
)
const selectedCount = computed(() => selectedIds.value.length)

onMounted(() => {
  try {
    const saved = Number(localStorage.getItem('quick-reply-admin-sidebar-width-v1') || 280)
    adminSidebarWidth.value = Number.isFinite(saved) ? Math.min(420, Math.max(180, saved)) : 280
  } catch {
    // ignore
  }
})

watch(
  () => route.query.editId,
  (editId) => {
    if (!editId) return
    const target = answersStore.list.find((item) => item._id === editId)
    if (target) editAnswer(target)
  },
  { immediate: true }
)

function clearQueryEditId() {
  if (!route.query.editId) return
  router.replace({ path: '/admin', query: { ...route.query, editId: undefined } })
}

function newAnswer() {
  editing.value = {
    title: '',
    categoryId: categoriesStore.list[0]?._id || 'cat_default',
    tags: [],
    content: '',
    images: []
  }
  showEditor.value = true
  clearQueryEditId()
}

function editAnswer(item) {
  editing.value = { ...item, tags: [...(item.tags || [])], images: [...(item.images || [])] }
  showEditor.value = true
}

function saveAnswer(answer) {
  answersStore.saveAnswer(answer)
  showEditor.value = false
  showToast('答案已保存')
  clearQueryEditId()
}

function removeAnswer(id) {
  answersStore.removeAnswer(id)
  selectedIds.value = selectedIds.value.filter((itemId) => itemId !== id)
  showToast('答案已删除')
}

function handleAddCategory(payload) {
  const result = categoriesStore.addCategory(payload)
  if (!result.ok) {
    showToast(result.message, 'error')
    return
  }
  showToast(`已新建分类：${result.data.name}`)
}

function handleRenameCategory(payload) {
  const result = categoriesStore.renameCategory(payload.id, payload.name)
  if (!result.ok) {
    showToast(result.message, 'error')
    return
  }
  showToast(`分类已更新：${result.data.name}`)
}

function handleMoveCategory(payload) {
  const result = categoriesStore.moveCategory(payload.id, payload.direction)
  if (!result.ok) showToast(result.message, 'error')
}

function handleDropCategory(payload) {
  const result = categoriesStore.moveCategoryByDrop(payload.dragId, payload.targetId, payload.mode)
  if (!result.ok) showToast(result.message, 'error')
}

function removeCategory(cat) {
  if (cat.name === '未分类') {
    showToast('未分类不可删除', 'error')
    return
  }

  const fallbackId = categoriesStore.getFallbackCategoryId()
  if (!fallbackId || fallbackId === cat._id) {
    showToast('没有可用目标分类', 'error')
    return
  }

  const affected = answersStore.moveAnswersToCategory(cat._id, fallbackId)
  const result = categoriesStore.removeCategory(cat._id)
  if (!result.ok) {
    showToast(result.message, 'error')
    return
  }

  showToast(`已删除分类，并迁移 ${affected} 条回复`) 
}

function onDropAnswerToCategory(payload) {
  const result = answersStore.moveAnswerToCategory(payload.answerId, payload.targetCategoryId)
  if (!result.ok) {
    showToast(result.message, 'error')
    return
  }
  showToast('已拖拽移动到目标分类')
}

function toggleOne(id, checked) {
  if (checked) {
    if (!selectedIds.value.includes(id)) selectedIds.value = [...selectedIds.value, id]
    return
  }
  selectedIds.value = selectedIds.value.filter((itemId) => itemId !== id)
}

function toggleAll(checked) {
  selectedIds.value = checked ? filteredList.value.map((item) => item._id) : []
}

function batchMoveCategory() {
  if (!selectedIds.value.length) return showToast('请先选择要处理的回复', 'error')
  if (!batchCategoryId.value) return showToast('请选择目标分类', 'error')
  const count = answersStore.bulkUpdateCategory(selectedIds.value, batchCategoryId.value)
  showToast(`已批量修改 ${count} 条回复分类`)
}

function parseTagsInput() {
  return batchTagInput.value
    .split(/[，,\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function batchAddTags() {
  if (!selectedIds.value.length) return showToast('请先选择要处理的回复', 'error')
  const tags = parseTagsInput()
  if (!tags.length) return showToast('请输入标签', 'error')
  const count = answersStore.bulkAddTags(selectedIds.value, tags)
  showToast(`已为 ${count} 条回复添加标签`)
}

function batchRemoveTags() {
  if (!selectedIds.value.length) return showToast('请先选择要处理的回复', 'error')
  const tags = parseTagsInput()
  if (!tags.length) return showToast('请输入标签', 'error')
  const count = answersStore.bulkRemoveTags(selectedIds.value, tags)
  showToast(`已为 ${count} 条回复移除标签`)
}

function batchDelete() {
  if (!selectedIds.value.length) return showToast('请先选择要处理的回复', 'error')
  const removed = selectedIds.value.length
  answersStore.removeAnswers(selectedIds.value)
  selectedIds.value = []
  showToast(`已批量删除 ${removed} 条回复`)
}

function batchDuplicate() {
  if (!selectedIds.value.length) return showToast('请先选择要处理的回复', 'error')
  const count = answersStore.duplicateAnswers(selectedIds.value)
  showToast(`已复制 ${count} 条回复为副本`)
}

function categoryLabel(cat) {
  return `${cat.level === 2 ? '  └ ' : ''}${cat.icon} ${cat.name}`
}

function startResizeAdminSidebar(e) {
  const startX = e.clientX
  const startWidth = adminSidebarWidth.value

  const onMove = (ev) => {
    const next = startWidth + (ev.clientX - startX)
    adminSidebarWidth.value = Math.min(420, Math.max(180, next))
  }

  const onUp = () => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    try {
      localStorage.setItem('quick-reply-admin-sidebar-width-v1', String(adminSidebarWidth.value))
    } catch {
      // ignore
    }
  }

  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

function onAnswerDragStart(item, e) {
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('application/x-quick-reply-drag-type', 'answer')
  e.dataTransfer.setData('application/x-quick-reply-answer-id', item._id)
}

function onAnswerDropOnRow(targetItem, e) {
  e.preventDefault()
  const type = e.dataTransfer.getData('application/x-quick-reply-drag-type')
  if (type !== 'answer') return

  const sourceId = e.dataTransfer.getData('application/x-quick-reply-answer-id')
  if (!sourceId || sourceId === targetItem._id) return

  const result = answersStore.reorderAnswerByFiltered(sourceId, targetItem._id, filteredList.value.map((i) => i._id))
  if (!result.ok) {
    showToast(result.message, 'error')
    return
  }
  showToast('已调整回复顺序')
}

function exportData() {
  const payload = {
    meta: {
      version: 1,
      exportedAt: new Date().toISOString(),
      app: 'quick-reply'
    },
    categories: categoriesStore.exportAll(),
    answers: answersStore.exportAll()
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
  const link = document.createElement('a')
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  link.href = URL.createObjectURL(blob)
  link.download = `quick-reply-backup-${stamp}.json`
  link.click()
  URL.revokeObjectURL(link.href)
  showToast('数据已导出')
}

function triggerImport() {
  importFileRef.value?.click()
}

function buildImportStats(categories = [], answers = []) {
  const currentCategoryIds = new Set(categoriesStore.list.map((c) => c._id))
  const currentAnswerIds = new Set(answersStore.list.map((a) => a._id))

  const categoryOverwrite = categories.filter((c) => c?._id && currentCategoryIds.has(c._id)).length
  const answerOverwrite = answers.filter((a) => a?._id && currentAnswerIds.has(a._id)).length

  importStats.value = {
    categoryNew: categories.length - categoryOverwrite,
    categoryOverwrite,
    answerNew: answers.length - answerOverwrite,
    answerOverwrite
  }
}

async function onImportFileChange(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return

  try {
    const text = await file.text()
    const data = JSON.parse(text)

    const categories = Array.isArray(data?.categories) ? data.categories : []
    const answers = Array.isArray(data?.answers) ? data.answers : []

    if (!categories.length && !answers.length) {
      showToast('导入文件为空或格式不正确', 'error')
      return
    }

    importPayload.value = {
      categories,
      answers,
      fileName: file.name
    }
    buildImportStats(categories, answers)
    importStrategy.value = 'preview'
    importDialog.value = true
  } catch {
    showToast('导入失败，请检查 JSON 文件格式', 'error')
  }
}

function applyImport() {
  const categories = importPayload.value.categories || []
  const answers = importPayload.value.answers || []

  if (importStrategy.value === 'preview') {
    showToast('这是预览模式，未执行导入')
    return
  }

  if (importStrategy.value === 'replace') {
    categoriesStore.replaceAll(categories)
    answersStore.replaceAll(answers)
    showToast('导入成功：已覆盖现有数据')
    importDialog.value = false
    return
  }

  categoriesStore.mergeAll(categories)
  answersStore.mergeAll(answers)
  showToast('导入成功：已合并数据')
  importDialog.value = false
}

function closeImportDialog() {
  importDialog.value = false
}
</script>

<template>
  <div class="admin-layout">
    <header class="top">
      <button class="btn ghost back-btn" @click="router.push('/')"><span class="back-icon">←</span><span class="back-text">返回</span></button>
      <div class="title">管理回复</div>
      <div class="top-actions">
        <button class="btn ghost" @click="exportData">导出</button>
        <button class="btn ghost" @click="triggerImport">导入</button>
        <input ref="importFileRef" type="file" accept="application/json" hidden @change="onImportFileChange" />
        <button class="btn create-btn" @click="newAnswer"><span class="create-icon">+</span><span class="create-text">新建答案</span></button>
      </div>
    </header>

    <div class="panel" :style="{ '--admin-sidebar-width': `${adminSidebarWidth}px` }">
      <div class="category-wrap">
        <CategorySidebar
          class="category-panel"
          :categories="categoriesStore.list"
          :current-id="filterCategoryId"
          :enable-drop-answer="true"
          @change="(id) => (filterCategoryId = id)"
          @add="handleAddCategory"
          @rename="handleRenameCategory"
          @remove="removeCategory"
          @move="handleMoveCategory"
          @drop-category="handleDropCategory"
          @drop-answer="onDropAnswerToCategory"
        />
        <div class="resize-handle" title="拖动调整侧栏宽度" @mousedown.prevent="startResizeAdminSidebar" />
      </div>

      <section class="table-wrap">
        <div class="toolbar">
          <input v-model="searchText" class="search-input" placeholder="按标题/内容/标签/分类搜索" />
          <select v-model="filterCategoryId" class="search-select">
            <option value="all">全部分类</option>
            <option v-for="cat in allCategoryOptions" :key="cat._id" :value="cat._id">{{ categoryLabel(cat) }}</option>
          </select>
        </div>

        <div class="batch-panel">
          <label class="select-all"><input type="checkbox" :checked="allChecked" @change="toggleAll($event.target.checked)" />已选 {{ selectedCount }} 条</label>
          <select v-model="batchCategoryId" class="batch-input">
            <option value="">批量修改分类...</option>
            <option v-for="cat in allCategoryOptions" :key="`batch-${cat._id}`" :value="cat._id">{{ categoryLabel(cat) }}</option>
          </select>
          <button class="btn ghost" @click="batchMoveCategory">应用分类</button>
          <input v-model="batchTagInput" class="batch-input" placeholder="标签，逗号分隔" />
          <button class="btn ghost" @click="batchAddTags">批量加标签</button>
          <button class="btn ghost" @click="batchRemoveTags">批量删标签</button>
          <button class="btn ghost" @click="batchDuplicate">批量复制副本</button>
          <button class="btn danger" @click="batchDelete">批量删除</button>
        </div>

        <section class="table">
          <div class="row head"><div>选择</div><div>标题</div><div>分类</div><div>标签</div><div>使用次数</div><div>操作</div></div>
          <div
            v-for="item in filteredList"
            :key="item._id"
            class="row"
            draggable="true"
            @dragstart="onAnswerDragStart(item, $event)"
            @dragover.prevent
            @drop="onAnswerDropOnRow(item, $event)"
          >
            <div><input type="checkbox" :checked="selectedIds.includes(item._id)" @change="toggleOne(item._id, $event.target.checked)" /></div>
            <div>{{ item.title }}</div>
            <div>{{ categoriesStore.list.find((c) => c._id === item.categoryId)?.name || '未分类' }}</div>
            <div>{{ (item.tags || []).join(' / ') }}</div>
            <div>{{ item.useCount || 0 }}</div>
            <div class="ops"><button class="btn ghost" @click="editAnswer(item)">编辑</button><button class="btn danger" @click="removeAnswer(item._id)">删除</button></div>
          </div>
        </section>
      </section>
    </div>

    <AnswerEditor :show="showEditor" :categories="categoriesStore.flattened" :model-value="editing || {}" @save="saveAnswer" @cancel="showEditor = false" />

    <div v-if="importDialog" class="confirm-mask" @click="closeImportDialog">
      <div class="confirm-card" @click.stop>
        <h3>导入数据</h3>
        <p class="muted">文件：{{ importPayload.fileName }}</p>

        <div class="stats">
          <div>分类：新增 {{ importStats.categoryNew }} / 覆盖 {{ importStats.categoryOverwrite }}</div>
          <div>回复：新增 {{ importStats.answerNew }} / 覆盖 {{ importStats.answerOverwrite }}</div>
        </div>

        <div class="strategy-group">
          <label><input v-model="importStrategy" type="radio" value="preview" /> 仅预览（不导入）</label>
          <label><input v-model="importStrategy" type="radio" value="merge" /> 合并导入（按 id 覆盖同名 id）</label>
          <label><input v-model="importStrategy" type="radio" value="replace" /> 覆盖导入（清空后导入）</label>
        </div>

        <div class="confirm-actions">
          <button class="btn" @click="applyImport">确认</button>
          <button class="btn ghost" @click="closeImportDialog">取消</button>
        </div>
      </div>
    </div>

    <transition name="fade"><div v-if="toast.show" class="toast" :class="{ error: toast.type === 'error' }">{{ toast.text }}</div></transition>
  </div>
</template>

<style scoped>
.admin-layout { padding: 12px; height: 100vh; box-sizing: border-box; background: var(--bg-base); color: var(--text-primary); }
.top { display: grid; grid-template-columns: auto 1fr auto; align-items: center; margin-bottom: 10px; gap: 8px; }
.top .title { justify-self: center; font-weight: 600; }
.back-btn, .create-btn { width: fit-content; display: inline-flex; align-items: center; gap: 6px; }
.top-actions { display: inline-flex; gap: 6px; align-items: center; }
.panel { display: grid; grid-template-columns: minmax(180px, var(--admin-sidebar-width, 280px)) 1fr; gap: 10px; height: calc(100% - 56px); min-height: 0; }
.category-wrap { position: relative; min-height: 0; }
.category-panel { height: 100%; }
.resize-handle { position: absolute; top: 0; right: -6px; width: 12px; height: 100%; cursor: col-resize; z-index: 5; }
.resize-handle::after { content: ''; position: absolute; left: 5px; top: 0; width: 2px; height: 100%; background: transparent; }
.resize-handle:hover::after { background: var(--accent); }
.table-wrap { display: grid; grid-template-rows: auto auto 1fr; gap: 8px; min-height: 0; }
.toolbar { display: grid; grid-template-columns: 1fr 220px; gap: 8px; }
.search-input,.search-select,.batch-input { border: 1px solid var(--border); background: var(--bg-elevated); color: var(--text-primary); border-radius: 6px; padding: 6px 8px; }
.batch-panel { border: 1px solid var(--border); border-radius: 8px; padding: 8px; background: var(--bg-surface); display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.select-all { display: inline-flex; align-items: center; gap: 6px; color: var(--text-secondary); padding-right: 6px; }
.table { border: 1px solid var(--border); background: var(--bg-surface); border-radius: 8px; overflow: auto; }
.row { display: grid; grid-template-columns: 56px 2fr 1fr 2fr 80px 160px; gap: 8px; align-items: center; padding: 10px 12px; border-bottom: 1px solid var(--border); }
.row.head { color: var(--text-secondary); font-size: 12px; background: var(--bg-elevated); }
.row[draggable='true'] { cursor: grab; }
.row[draggable='true']:active { cursor: grabbing; }
.ops { display: flex; gap: 8px; }
.btn { border: 0; border-radius: 4px; padding: 6px 10px; cursor: pointer; background: var(--accent); color: white; }
.btn.ghost { background: var(--bg-hover); color: var(--text-primary); }
.btn.danger { background: rgba(239, 68, 68, 0.2); color: #f87171; }
.confirm-mask { position: fixed; inset: 0; display: grid; place-items: center; background: rgba(0,0,0,.35); z-index: 30; }
.confirm-card { width: min(520px, 92vw); background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 8px; padding: 12px; }
.muted { color: var(--text-secondary); font-size: 12px; }
.stats { border: 1px solid var(--border); border-radius: 6px; padding: 8px; background: var(--bg-surface); margin: 8px 0; color: var(--text-secondary); font-size: 13px; display: grid; gap: 4px; }
.strategy-group { display: grid; gap: 6px; margin-bottom: 10px; color: var(--text-primary); }
.confirm-actions { display: flex; justify-content: flex-end; gap: 8px; }
.toast { position: fixed; right: 16px; bottom: 16px; padding: 8px 12px; border: 1px solid var(--border); background: var(--success-soft); color: var(--success); border-radius: 6px; font-size: 12px; }
.toast.error { background: rgba(239, 68, 68, 0.2); color: #f87171; }
.fade-enter-active,.fade-leave-active { transition: opacity 0.18s ease; }
.fade-enter-from,.fade-leave-to { opacity: 0; }

@media (max-width: 980px) { .panel { grid-template-columns: 1fr; grid-template-rows: 220px 1fr; } }
@media (max-width: 720px) {
  .admin-layout { padding: 8px; }
  .back-text, .create-text { display: none; }
  .toolbar { grid-template-columns: 1fr; }
  .row { grid-template-columns: 1fr; align-items: start; }
  .row.head { display: none; }
}
</style>
