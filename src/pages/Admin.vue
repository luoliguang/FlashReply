<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Plus, GripVertical, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-vue-next'
import { getTagColor } from '../utils/tag-color'
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
const adminSidebarCollapsed = ref(false)
const pendingDeleteCategory = ref(null)
const migrateTargetId = ref('')
const LAST_MIGRATE_TARGET_KEY = 'quick-reply-last-migrate-target-v1'

const pendingDeleteItems = computed(() =>
  !pendingDeleteCategory.value ? [] : answersStore.list.filter((item) => item.categoryId === pendingDeleteCategory.value._id)
)
const pendingDeleteCount = computed(() => pendingDeleteItems.value.length)
const pendingDeletePreview = computed(() => pendingDeleteItems.value.slice(0, 3).map((item) => item.title))
const migrateTargets = computed(() =>
  !pendingDeleteCategory.value ? [] : categoriesStore.list.filter((c) => c._id !== pendingDeleteCategory.value._id)
)

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

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200]
const PAGE_SIZE_KEY = 'quick-reply-admin-page-size-v1'
const pageSize = ref((() => {
  const saved = Number(localStorage.getItem(PAGE_SIZE_KEY))
  return PAGE_SIZE_OPTIONS.includes(saved) ? saved : 20
})())
const currentPage = ref(1)

watch(pageSize, (val) => {
  localStorage.setItem(PAGE_SIZE_KEY, String(val))
  currentPage.value = 1
})

let toastTimer = null
let deleteTimer = null
let batchDeleteTimer = null
const pendingDeleteId = ref('')
const pendingBatchDelete = ref(false)
const expandedIds = ref([])

function toggleExpand(id) {
  const idx = expandedIds.value.indexOf(id)
  if (idx >= 0) expandedIds.value.splice(idx, 1)
  else expandedIds.value.push(id)
}

function showToast(text, type = 'success') {
  toast.value = { show: true, text, type }
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value.show = false
  }, 1600)
}

const allCategoryOptions = computed(() => categoriesStore.flattened)

const filteredList = computed(() => {
  const tokens = searchText.value.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const branchIds = new Set(categoriesStore.getBranchIds(filterCategoryId.value))

  return answersStore.list.filter((item) => {
    const byCategory = filterCategoryId.value === 'all' ? true : branchIds.has(item.categoryId)
    if (!byCategory) return false

    if (!tokens.length) return true

    const categoryName = categoriesStore.list.find((c) => c._id === item.categoryId)?.name || ''
    const haystack = [item.title || '', item.content || '', (item.tags || []).join(' '), categoryName].join(' ').toLowerCase()
    return tokens.every((t) => haystack.includes(t))
  })
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredList.value.length / pageSize.value)))
const pagedList = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredList.value.slice(start, start + pageSize.value)
})
const pageInfo = computed(() => {
  const total = filteredList.value.length
  const start = Math.min((currentPage.value - 1) * pageSize.value + 1, total)
  const end = Math.min(currentPage.value * pageSize.value, total)
  return { total, start, end }
})

watch([searchText, filterCategoryId], () => { currentPage.value = 1 })
watch(selectedIds, () => {
  if (pendingBatchDelete.value) {
    pendingBatchDelete.value = false
    clearTimeout(batchDeleteTimer)
  }
})

const allChecked = computed(
  () => pagedList.value.length > 0 && pagedList.value.every((item) => selectedIds.value.includes(item._id))
)
const selectedCount = computed(() => selectedIds.value.length)

onMounted(() => {
  try {
    const saved = Number(localStorage.getItem('quick-reply-admin-sidebar-width-v1') || 280)
    adminSidebarWidth.value = Number.isFinite(saved) ? Math.min(420, Math.max(180, saved)) : 280
  } catch {
    // ignore
  }

  try {
    adminSidebarCollapsed.value = localStorage.getItem('quick-reply-admin-sidebar-collapsed-v1') === '1'
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

function startDelete(id) {
  if (pendingDeleteId.value === id) {
    clearTimeout(deleteTimer)
    pendingDeleteId.value = ''
    removeAnswer(id)
    return
  }
  pendingDeleteId.value = id
  clearTimeout(deleteTimer)
  deleteTimer = setTimeout(() => { pendingDeleteId.value = '' }, 3000)
}

function tagStyle(tag) {
  const palette = getTagColor(tag)
  return { '--tag-bg': palette.bg, '--tag-color': palette.color }
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
  const result = categoriesStore.renameCategory(payload.id, payload.name, payload.icon)
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

function handlePromoteCategory(payload) {
  const result = categoriesStore.promoteCategoryToTopLevel(payload.dragId)
  if (!result.ok) { showToast(result.message, 'error'); return }
  showToast('已升级为一级分类')
}

function removeCategory(cat) {
  pendingDeleteCategory.value = cat

  let lastTarget = ''
  try { lastTarget = localStorage.getItem(LAST_MIGRATE_TARGET_KEY) || '' } catch { /* ignore */ }

  const fallbackId = categoriesStore.getFallbackCategoryId()
  const isValidLast = !!lastTarget && lastTarget !== cat._id && categoriesStore.list.some((c) => c._id === lastTarget)
  migrateTargetId.value = isValidLast ? lastTarget : (fallbackId && fallbackId !== cat._id ? fallbackId : '')
}

function confirmRemoveCategory() {
  const category = pendingDeleteCategory.value
  if (!category) return

  const count = pendingDeleteCount.value

  if (count > 0) {
    if (!migrateTargetId.value || migrateTargetId.value === category._id) {
      showToast('请选择有效的迁移目标分类', 'error')
      return
    }
    answersStore.moveAnswersToCategory(category._id, migrateTargetId.value)
    try { localStorage.setItem(LAST_MIGRATE_TARGET_KEY, migrateTargetId.value) } catch { /* ignore */ }
  }

  const result = categoriesStore.removeCategory(category._id)
  if (!result.ok) { showToast(result.message, 'error'); return }

  if (filterCategoryId.value === category._id) filterCategoryId.value = 'all'

  const targetName = categoriesStore.list.find((c) => c._id === migrateTargetId.value)?.name || ''
  const catName = category.name
  pendingDeleteCategory.value = null
  showToast(count > 0 ? `已删除分类，并迁移 ${count} 条回复到「${targetName}」` : `已删除分类「${catName}」`)
}

function onDropAnswerToCategory(payload) {
  const result = answersStore.moveAnswerToCategory(payload.answerId, payload.targetCategoryId)
  if (!result.ok) {
    showToast(result.message, 'error')
    return
  }
  filterCategoryId.value = payload.targetCategoryId
  showToast('已移动到目标分类')
}

function toggleOne(id, checked) {
  if (checked) {
    if (!selectedIds.value.includes(id)) selectedIds.value = [...selectedIds.value, id]
    return
  }
  selectedIds.value = selectedIds.value.filter((itemId) => itemId !== id)
}

function toggleAll(checked) {
  if (checked) {
    const toAdd = pagedList.value.map((item) => item._id).filter((id) => !selectedIds.value.includes(id))
    selectedIds.value = [...selectedIds.value, ...toAdd]
  } else {
    const pageIds = new Set(pagedList.value.map((item) => item._id))
    selectedIds.value = selectedIds.value.filter((id) => !pageIds.has(id))
  }
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
  if (!pendingBatchDelete.value) {
    pendingBatchDelete.value = true
    clearTimeout(batchDeleteTimer)
    batchDeleteTimer = setTimeout(() => { pendingBatchDelete.value = false }, 3000)
    return
  }
  clearTimeout(batchDeleteTimer)
  pendingBatchDelete.value = false
  const removed = selectedIds.value.length
  answersStore.removeAnswers(selectedIds.value)
  selectedIds.value = []
  showToast(`已批量删除 ${removed} 条回复`)
}

function duplicateOne(id) {
  answersStore.duplicateAnswers([id])
  showToast('已复制为副本')
}

function batchDuplicate() {
  if (!selectedIds.value.length) return showToast('请先选择要处理的回复', 'error')
  const count = answersStore.duplicateAnswers(selectedIds.value)
  selectedIds.value = []
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
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    try {
      localStorage.setItem('quick-reply-admin-sidebar-width-v1', String(adminSidebarWidth.value))
    } catch {
      // ignore
    }
  }

  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'col-resize'
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

function toggleAdminSidebar() {
  adminSidebarCollapsed.value = !adminSidebarCollapsed.value
  try {
    localStorage.setItem('quick-reply-admin-sidebar-collapsed-v1', adminSidebarCollapsed.value ? '1' : '0')
  } catch {
    // ignore
  }
}
</script>

<template>
  <div class="admin-layout">
    <header class="top">
      <button class="btn ghost back-btn" @click="router.push('/')"><ArrowLeft :size="15" /><span class="back-text">返回</span></button>
      <div class="title">管理回复</div>
      <div class="top-actions">
        <button class="btn ghost" @click="exportData">导出</button>
        <button class="btn ghost" @click="triggerImport">导入</button>
        <input ref="importFileRef" type="file" accept="application/json" hidden @change="onImportFileChange" />
        <button class="btn create-btn" @click="newAnswer"><Plus :size="15" /><span class="create-text">新建答案</span></button>
      </div>
    </header>

    <div class="panel" :class="{ 'sidebar-collapsed': adminSidebarCollapsed }" :style="{ '--admin-sidebar-width': `${adminSidebarWidth}px` }">
      <div class="category-wrap">
        <button v-if="adminSidebarCollapsed" class="btn-sidebar-expand" title="展开侧栏" @click="toggleAdminSidebar">
          <ChevronsRight :size="13" />
        </button>
        <CategorySidebar
          v-show="!adminSidebarCollapsed"
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
          @promote-category="handlePromoteCategory"
          @drop-answer="onDropAnswerToCategory"
        >
          <template #collapse-btn>
            <button class="btn-sidebar-toggle" title="收起侧栏" @click="toggleAdminSidebar">
              <ChevronsLeft :size="12" />
            </button>
          </template>
        </CategorySidebar>
        <div v-show="!adminSidebarCollapsed" class="resize-handle" title="拖动调整侧栏宽度" @mousedown.prevent="startResizeAdminSidebar" />
      </div>

      <section class="table-wrap">
        <!-- 搜索栏 -->
        <div class="toolbar">
          <input v-model="searchText" class="search-input" placeholder="按标题 / 内容 / 标签 / 分类搜索" />
          <select v-model="filterCategoryId" class="search-select">
            <option value="all">全部分类</option>
            <option v-for="cat in allCategoryOptions" :key="cat._id" :value="cat._id">{{ categoryLabel(cat) }}</option>
          </select>
        </div>

        <!-- 全选行 + 选中后展开的操作栏 -->
        <div class="batch-header">
          <label class="select-all checkbox-wrap">
            <input type="checkbox" :checked="allChecked" @change="toggleAll($event.target.checked)" />
            <span class="checkbox-box" />
            <span class="select-count">{{ selectedCount > 0 ? `已选 ${selectedCount} 条` : `共 ${filteredList.length} 条` }}</span>
          </label>

          <!-- 选中后才展开的操作区 -->
          <transition name="batch-slide">
            <div v-if="selectedCount > 0" class="batch-actions">
              <!-- 分类移动 -->
              <div class="batch-group">
                <select v-model="batchCategoryId" class="batch-select">
                  <option value="">移动到分类…</option>
                  <option v-for="cat in allCategoryOptions" :key="`batch-${cat._id}`" :value="cat._id">{{ categoryLabel(cat) }}</option>
                </select>
                <button class="btn ghost sm" @click="batchMoveCategory">应用</button>
              </div>
              <!-- 标签管理 -->
              <div class="batch-group">
                <input v-model="batchTagInput" class="batch-tag-input" placeholder="标签，逗号分隔" />
                <button class="btn ghost sm" @click="batchAddTags">+ 标签</button>
                <button class="btn ghost sm" @click="batchRemoveTags">- 标签</button>
              </div>
              <!-- 其他操作 -->
              <div class="batch-group">
                <button class="btn ghost sm" @click="batchDuplicate">复制副本</button>
                <button
                  class="btn sm"
                  :class="pendingBatchDelete ? 'danger-confirm' : 'danger'"
                  @click="batchDelete"
                >{{ pendingBatchDelete ? `确认删除 ${selectedCount} 条?` : '删除' }}</button>
              </div>
            </div>
          </transition>
        </div>

        <!-- 数据表格 -->
        <section class="table">
          <div class="row head">
            <div class="col-drag" />
            <div class="col-check" />
            <div class="col-title">标题</div>
            <div class="col-cat">分类</div>
            <div class="col-tags">标签</div>
            <div class="col-count">次数</div>
            <div class="col-ops">操作</div>
          </div>

          <div
            v-for="item in pagedList"
            :key="item._id"
            class="row-wrap"
            :class="{ 'row-expanded': expandedIds.includes(item._id) }"
          >
            <div
              class="row"
              :class="{ selected: selectedIds.includes(item._id) }"
              draggable="true"
              @dragstart="onAnswerDragStart(item, $event)"
              @dragover.prevent
              @drop="onAnswerDropOnRow(item, $event)"
            >
              <!-- 拖拽手柄 -->
              <div class="col-drag drag-handle">
                <GripVertical :size="14" />
              </div>
              <!-- 复选框 -->
              <div class="col-check">
                <label class="checkbox-wrap">
                  <input type="checkbox" :checked="selectedIds.includes(item._id)" @change="toggleOne(item._id, $event.target.checked)" />
                  <span class="checkbox-box" />
                </label>
              </div>
              <!-- 标题（可点击展开内容预览） -->
              <div class="col-title row-title" @click.stop="toggleExpand(item._id)">
                <ChevronRight :size="11" class="expand-icon" />
                <span class="title-text">{{ item.title }}</span>
              </div>
              <!-- 分类 -->
              <div class="col-cat row-cat">{{ categoriesStore.list.find((c) => c._id === item.categoryId)?.name || '未分类' }}</div>
              <!-- 标签 -->
              <div class="col-tags row-tags">
                <span v-for="tag in (item.tags || [])" :key="tag" class="tag-chip" :style="tagStyle(tag)">{{ tag }}</span>
              </div>
              <!-- 使用次数 -->
              <div class="col-count">{{ item.useCount || 0 }}</div>
              <!-- 操作 -->
              <div class="col-ops ops">
                <button class="btn ghost sm" @click="editAnswer(item)">编辑</button>
                <button class="btn ghost sm" @click="duplicateOne(item._id)">复制</button>
                <button
                  class="btn sm"
                  :class="pendingDeleteId === item._id ? 'danger-confirm' : 'danger'"
                  @click="startDelete(item._id)"
                >
                  {{ pendingDeleteId === item._id ? '确认?' : '删除' }}
                </button>
              </div>
            </div>

            <!-- 内容预览（点击标题展开） -->
            <transition name="content-expand">
              <div v-if="expandedIds.includes(item._id)" class="row-preview">
                <div class="row-preview-inner">{{ item.content || '（无内容）' }}</div>
              </div>
            </transition>
          </div>

          <!-- 空状态 -->
          <div v-if="pagedList.length === 0" class="empty-state">
            <p>{{ searchText ? `没有匹配「${searchText}」的回复` : '该分类下暂无回复' }}</p>
            <button class="btn" @click="newAnswer"><Plus :size="13" />新建回复</button>
          </div>
        </section>

        <!-- 分页栏 -->
        <div v-if="filteredList.length > 0" class="pagination">
          <div class="page-size-wrap">
            <span class="page-info">第 {{ pageInfo.start }}–{{ pageInfo.end }} 条，共 {{ pageInfo.total }} 条</span>
            <select v-model="pageSize" class="page-size-select">
              <option v-for="n in PAGE_SIZE_OPTIONS" :key="n" :value="n">{{ n }} 条/页</option>
            </select>
          </div>
          <div class="page-controls">
            <button class="page-btn" :disabled="currentPage === 1" @click="currentPage = 1">«</button>
            <button class="page-btn" :disabled="currentPage === 1" @click="currentPage--">‹</button>
            <template v-for="p in totalPages" :key="p">
              <button
                v-if="Math.abs(p - currentPage) <= 2 || p === 1 || p === totalPages"
                class="page-btn"
                :class="{ active: p === currentPage }"
                @click="currentPage = p"
              >{{ p }}</button>
              <span v-else-if="p === currentPage - 3 || p === currentPage + 3" class="page-ellipsis">…</span>
            </template>
            <button class="page-btn" :disabled="currentPage === totalPages" @click="currentPage++">›</button>
            <button class="page-btn" :disabled="currentPage === totalPages" @click="currentPage = totalPages">»</button>
          </div>
        </div>
      </section>

    </div>

    <AnswerEditor :show="showEditor" :categories="categoriesStore.flattened" :model-value="editing || {}" @save="saveAnswer" @cancel="showEditor = false" />

    <Teleport to="body">
    <div v-if="pendingDeleteCategory" class="confirm-mask" @click.self="pendingDeleteCategory = null">
      <div class="confirm-card">
        <h3>确认删除分类</h3>

        <!-- 有回复：需要迁移 -->
        <template v-if="pendingDeleteCount > 0">
          <p class="muted">
            将删除「{{ pendingDeleteCategory.name }}」，并把
            <strong>{{ pendingDeleteCount }}</strong> 条回复迁移到：
          </p>
          <div v-if="pendingDeletePreview.length" class="preview-box">
            <div class="preview-title">受影响回复：</div>
            <ul><li v-for="title in pendingDeletePreview" :key="title">{{ title }}</li></ul>
            <div v-if="pendingDeleteCount > 3" class="muted">... 还有 {{ pendingDeleteCount - 3 }} 条</div>
          </div>
          <select v-model="migrateTargetId" class="search-select" style="width:100%;margin-bottom:10px">
            <option v-for="target in migrateTargets" :key="target._id" :value="target._id">
              {{ target.icon }} {{ target.name }}
            </option>
          </select>
        </template>

        <!-- 空分类：直接确认 -->
        <template v-else>
          <p class="muted">「{{ pendingDeleteCategory.name }}」是空分类，确认删除？</p>
        </template>

        <div class="confirm-actions">
          <button class="btn danger" @click="confirmRemoveCategory">确认删除</button>
          <button class="btn ghost" @click="pendingDeleteCategory = null">取消</button>
        </div>
      </div>
    </div>
    </Teleport>

    <Teleport to="body">
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
    </Teleport>

    <transition name="fade"><div v-if="toast.show" class="toast" :class="{ error: toast.type === 'error' }">{{ toast.text }}</div></transition>
  </div>
</template>

<style scoped>
/* ── Keyframes ──────────────────────────────────────────────── */
@keyframes row-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes fade-up {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes toast-in {
  from { opacity: 0; transform: translateX(14px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes confirm-in {
  from { opacity: 0; transform: scale(0.96) translateY(-6px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes danger-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); }
  60%  { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0); }
  100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
}

/* ── Layout ─────────────────────────────────────────────────── */
.admin-layout {
  padding: 12px;
  height: 100vh;
  box-sizing: border-box;
  background: var(--bg-base);
  color: var(--text-primary);
}
.top {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  margin-bottom: 10px;
  gap: 8px;
}
.top .title { justify-self: center; font-weight: 600; letter-spacing: 0.01em; }
.back-btn, .create-btn { width: fit-content; display: inline-flex; align-items: center; gap: 5px; }
.top-actions { display: inline-flex; gap: 6px; align-items: center; }
.panel {
  display: grid;
  grid-template-columns: minmax(180px, var(--admin-sidebar-width, 280px)) 1fr;
  gap: 10px;
  height: calc(100% - 56px);
  min-height: 0;
  transition: grid-template-columns 0.2s ease;
}
.panel.sidebar-collapsed {
  grid-template-columns: 28px 1fr;
  gap: 4px;
}
.category-wrap { position: relative; min-height: 0; overflow: hidden; }
.btn-sidebar-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  flex-shrink: 0;
}
.btn-sidebar-toggle:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.btn-sidebar-expand {
  position: absolute;
  top: 4px;
  left: 3px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--bg-surface);
  color: var(--text-secondary);
  cursor: pointer;
}
.btn-sidebar-expand:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.category-panel { height: 100%; }
.resize-handle {
  position: absolute; top: 0; right: -6px;
  width: 12px; height: 100%;
  cursor: col-resize; z-index: 5;
}
.resize-handle::after {
  content: '';
  position: absolute; left: 5px; top: 10%; width: 2px; height: 80%;
  background: transparent;
  border-radius: 2px;
  transition: background 0.2s ease;
}
.resize-handle:hover::after { background: var(--accent); }

/* ── Table wrap ─────────────────────────────────────────────── */
.table-wrap {
  display: grid;
  grid-template-rows: auto auto 1fr auto;
  gap: 8px;
  min-height: 0;
}

/* ── Toolbar ────────────────────────────────────────────────── */
.toolbar { display: grid; grid-template-columns: 1fr 220px; gap: 8px; }
.search-input,
.search-select {
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-primary);
  border-radius: 6px;
  padding: 6px 10px;
  outline: none;
  transition: border-color 0.15s ease;
}
.search-input:focus,
.search-select:focus { border-color: var(--accent); }

/* ── Batch header ───────────────────────────────────────────── */
.batch-header {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 12px;
  background: var(--bg-surface);
  min-height: 36px;
  transition: border-color 0.2s ease;
}
.batch-header:has(.batch-actions) { border-color: rgba(59, 130, 246, 0.35); }

.select-all {
  gap: 6px;
  flex-shrink: 0;
}
.select-count {
  color: var(--text-secondary);
  font-size: 12px;
  white-space: nowrap;
}

.batch-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.batch-group {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding-left: 8px;
  border-left: 1px solid var(--border);
}
.batch-select,
.batch-tag-input {
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-primary);
  border-radius: 5px;
  padding: 3px 8px;
  font-size: 12px;
  height: 26px;
  outline: none;
  transition: border-color 0.15s ease;
}
.batch-select:focus,
.batch-tag-input:focus { border-color: var(--accent); }
.batch-tag-input { width: 130px; }

/* batch-slide: horizontal reveal from left */
.batch-slide-enter-active {
  transition: opacity 0.18s ease, transform 0.18s cubic-bezier(0.2, 0, 0, 1);
}
.batch-slide-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}
.batch-slide-enter-from,
.batch-slide-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

/* ── Table ──────────────────────────────────────────────────── */
.table {
  border: 1px solid var(--border);
  background: var(--bg-surface);
  border-radius: 8px;
  overflow: auto;
}

/* ── Row wrapper (groups row + expanded preview) ────────────── */
.row-wrap {
  border-bottom: 1px solid var(--border);
  animation: row-in 0.16s ease both;
}
.row-wrap:last-child { border-bottom: none; }

/* column grid: drag | check | title | cat | tags | count | ops */
.row {
  display: grid;
  grid-template-columns: 20px 32px 2fr 1fr 2fr 56px 148px;
  gap: 8px;
  align-items: center;
  padding: 8px 10px;
  transition: background 0.1s ease, box-shadow 0.1s ease;
}
.row.head {
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
  animation: none;
}

/* ── Row interaction states (Raycast-inspired) ──────────────── */
.row:not(.head):hover { background: var(--bg-elevated); }
.row.selected { background: var(--bg-elevated); box-shadow: inset 2px 0 0 var(--accent); }
.row.selected:hover { background: var(--bg-hover); box-shadow: inset 2px 0 0 var(--accent); }

/* ── Columns ────────────────────────────────────────────────── */
.col-drag  { display: flex; align-items: center; justify-content: center; }
.col-check { display: flex; align-items: center; }
.col-title { overflow: hidden; }
.col-cat   { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.col-tags  { display: flex; flex-wrap: wrap; gap: 3px; }
.col-count { text-align: right; color: var(--text-muted); font-size: 12px; font-variant-numeric: tabular-nums; }
.col-ops   { display: flex; gap: 5px; justify-content: flex-end; }

/* ── Drag handle ────────────────────────────────────────────── */
.drag-handle {
  color: var(--text-muted); cursor: grab;
  opacity: 0; transition: opacity 0.12s ease, color 0.12s ease;
}
.row:hover .drag-handle { opacity: 0.6; }
.row.selected .drag-handle { opacity: 0.5; color: var(--accent); }
.drag-handle:active { cursor: grabbing; }

/* ── Row title (expand trigger) ─────────────────────────────── */
.row-title {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  user-select: none;
}
.row-title:hover .title-text { color: var(--accent); }
.title-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  font-weight: 500;
  transition: color 0.12s ease;
}
.expand-icon {
  flex-shrink: 0;
  color: var(--text-muted);
  transition: transform 0.18s cubic-bezier(0.2, 0, 0, 1), color 0.12s ease;
}
.row-wrap.row-expanded .expand-icon {
  transform: rotate(90deg);
  color: var(--accent);
}

/* ── Content preview (expanded) ─────────────────────────────── */
.row-preview {
  overflow: hidden;
  background: rgba(0, 0, 0, 0.18);
  border-top: 1px solid var(--border);
}
.row-preview-inner {
  /* indent to align under title text */
  padding: 8px 12px 10px calc(20px + 32px + 11px + 5px + 10px + 8px);
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 140px;
  overflow-y: auto;
}
.row-preview-inner::-webkit-scrollbar { width: 4px; }
.row-preview-inner::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

/* content-expand transition */
.content-expand-enter-active { transition: max-height 0.22s cubic-bezier(0.2, 0, 0, 1), opacity 0.18s ease; }
.content-expand-leave-active { transition: max-height 0.16s ease, opacity 0.12s ease; }
.content-expand-enter-from,
.content-expand-leave-to { max-height: 0; opacity: 0; }
.content-expand-enter-to,
.content-expand-leave-from { max-height: 160px; opacity: 1; }

/* ── Row text ───────────────────────────────────────────────── */
.row-cat { font-size: 12px; color: var(--text-secondary); }

/* ── Custom checkbox ────────────────────────────────────────── */
.checkbox-wrap {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  position: relative;
}
.checkbox-wrap input[type="checkbox"] {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;
}
.checkbox-box {
  width: 14px;
  height: 14px;
  border: 1.5px solid var(--border);
  border-radius: 3px;
  background: var(--bg-elevated);
  display: inline-block;
  position: relative;
  transition: border-color 0.15s ease, background 0.15s ease, transform 0.1s ease;
  flex-shrink: 0;
}
/* hover */
.checkbox-wrap:hover .checkbox-box { border-color: var(--accent); }
/* checked */
.checkbox-wrap input:checked + .checkbox-box {
  background: var(--accent);
  border-color: var(--accent);
  transform: scale(1.05);
}
/* checkmark */
.checkbox-wrap input:checked + .checkbox-box::after {
  content: '';
  position: absolute;
  left: 3.5px;
  top: 1px;
  width: 4px;
  height: 7.5px;
  border: 1.5px solid #fff;
  border-top: none;
  border-left: none;
  transform: rotate(43deg);
}

/* ── Tag chips ──────────────────────────────────────────────── */
.tag-chip {
  display: inline-block;
  padding: 1px 7px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  background: var(--tag-bg);
  color: var(--tag-color);
  white-space: nowrap;
  transition: filter 0.12s ease;
}
.tag-chip:hover { filter: brightness(1.15); }

/* ── Empty state ────────────────────────────────────────────── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 20px;
  color: var(--text-muted);
  font-size: 13px;
  animation: fade-up 0.2s ease both;
}

/* ── Buttons ────────────────────────────────────────────────── */
.btn {
  border: 0;
  border-radius: 5px;
  padding: 6px 10px;
  cursor: pointer;
  background: var(--accent);
  color: white;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 500;
  transition: background 0.15s ease, opacity 0.15s ease, transform 0.1s ease;
}
.btn:hover { opacity: 0.9; }
.btn:active { transform: scale(0.97); }

.btn.ghost {
  background: var(--bg-elevated);
  color: var(--text-primary);
  border: 1px solid var(--border);
}
.btn.ghost:hover { background: var(--bg-hover); border-color: rgba(255,255,255,0.12); }

.btn.danger {
  background: rgba(239, 68, 68, 0.12);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.2);
}
.btn.danger:hover { background: rgba(239, 68, 68, 0.2); }

.btn.danger-confirm {
  background: rgba(239, 68, 68, 0.25);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.45);
  animation: danger-pulse 0.6s ease;
}

.btn.sm { padding: 3px 8px; font-size: 12px; }

/* ── Dialogs ────────────────────────────────────────────────── */
.confirm-mask {
  position: fixed; inset: 0;
  display: grid; place-items: center;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(2px);
  z-index: 30;
}
.confirm-card {
  width: min(480px, 92vw);
  background: var(--bg-elevated);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 16px;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.5);
  animation: confirm-in 0.2s cubic-bezier(0.2, 0, 0, 1) both;
}
.confirm-card h3 { margin: 0 0 8px; font-size: 15px; }
.preview-box {
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-surface);
  padding: 8px;
  margin-bottom: 8px;
  font-size: 12px;
}
.preview-title { color: var(--text-primary); margin-bottom: 4px; }
.preview-box ul { margin: 0; padding-left: 16px; color: var(--text-secondary); }
.muted { color: var(--text-secondary); font-size: 12px; }
.stats {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px;
  background: var(--bg-surface);
  margin: 8px 0;
  color: var(--text-secondary);
  font-size: 13px;
  display: grid;
  gap: 4px;
}
.strategy-group { display: grid; gap: 6px; margin-bottom: 10px; color: var(--text-primary); }
.confirm-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }

/* ── Toast ──────────────────────────────────────────────────── */
.toast {
  position: fixed; right: 16px; bottom: 16px;
  padding: 8px 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: var(--bg-elevated);
  color: var(--success);
  border-radius: 7px;
  font-size: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}
.toast.error { color: #f87171; }
/* toast uses Vue fade transition, but we override the enter animation */
.fade-enter-active { animation: toast-in 0.2s cubic-bezier(0.2, 0, 0, 1) both; }
.fade-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.fade-leave-to { opacity: 0; transform: translateX(6px); }

/* ── Pagination ─────────────────────────────────────────────── */
.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 4px 2px;
  flex-shrink: 0;
}
.page-size-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}
.page-info {
  font-size: 12px;
  color: var(--text-secondary);
}
.page-size-select {
  height: 26px;
  padding: 0 6px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--bg-elevated);
  color: var(--text-secondary);
  font-size: 12px;
  outline: none;
  cursor: pointer;
  transition: border-color 0.12s ease, color 0.12s ease;
}
.page-size-select:hover,
.page-size-select:focus {
  border-color: var(--accent);
  color: var(--text-primary);
}
.page-controls {
  display: flex;
  align-items: center;
  gap: 3px;
}
.page-btn {
  min-width: 28px;
  height: 26px;
  padding: 0 6px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--bg-elevated);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.page-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: rgba(255, 255, 255, 0.12);
}
.page-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.page-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.page-ellipsis {
  font-size: 12px;
  color: var(--text-muted);
  padding: 0 2px;
}

/* ── Responsive ─────────────────────────────────────────────── */
@media (max-width: 980px) {
  .panel { grid-template-columns: 1fr; grid-template-rows: 220px 1fr; }
}
@media (max-width: 720px) {
  .admin-layout { padding: 8px; }
  .back-text, .create-text { display: none; }
  .toolbar { grid-template-columns: 1fr; }
  .row { grid-template-columns: 20px 32px 1fr 100px; }
  .col-cat, .col-count { display: none; }
  .row.head { display: none; }
}
</style>
