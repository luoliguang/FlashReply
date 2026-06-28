<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Menu, Settings, HelpCircle } from 'lucide-vue-next'
import SearchBar from '../components/SearchBar.vue'
import CategorySidebar from '../components/CategorySidebar.vue'
import AnswerList from '../components/AnswerList.vue'
import VarFillModal from '../components/VarFillModal.vue'
import CopyAssistant from '../components/CopyAssistant.vue'
import OnboardingModal from '../components/OnboardingModal.vue'
import { useAnswersStore } from '../stores/answers'
import { useCategoriesStore } from '../stores/categories'
import { parseVariables, fillVariables } from '../utils/variables'
import { copyFlow, insertFlow } from '../utils/clipboard'

const router = useRouter()
const answersStore = useAnswersStore()
const categoriesStore = useCategoriesStore()

const showVarModal = ref(false)
const activeAnswer = ref(null)
const pendingVars = ref([])
const activeIndex = ref(0)
const showOnboarding = ref(false)
const showCopyAssistant = ref(false)
const assistantAnswer = ref(null)
const assistantText = ref('')
const copiedId = ref('')
const toast = ref({ show: false, text: '', type: 'success' })
const pendingDeleteCategory = ref(null)
const migrateTargetId = ref('')
const sidebarDrawerOpen = ref(false)
const insertStrategy = ref(localStorage.getItem('quick-reply-insert-strategy-v1') || 'copy')
const sidebarWidth = ref(220)
const searchBarRef = ref(null)

watch(() => answersStore.enterSignal, () => {
  searchBarRef.value?.focus()
})

const MIGRATION_NOTICE_KEY = 'quick-reply-migration-notice-v1'
const LAST_MIGRATE_TARGET_KEY = 'quick-reply-last-migrate-target-v1'

let toastTimer = null
let copiedTimer = null

function onKeydown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
    const current = list.value[activeIndex.value]
    if (!current) return
    e.preventDefault()
    onCopy(current)
  }
}

const ONBOARDING_KEY = 'quick-reply-onboarding-done-v1'

onMounted(() => {
  window.addEventListener('keydown', onKeydown)

  try {
    const savedWidth = Number(localStorage.getItem('quick-reply-main-sidebar-width-v1') || 220)
    sidebarWidth.value = Number.isFinite(savedWidth) ? Math.min(360, Math.max(180, savedWidth)) : 220
  } catch {
    // ignore storage errors
  }

  try {
    const hasShown = localStorage.getItem(MIGRATION_NOTICE_KEY)
    if (!hasShown) {
      showToast('已完成旧版本数据迁移与配置统一')
      localStorage.setItem(MIGRATION_NOTICE_KEY, '1')
    }
  } catch {
    // ignore storage errors
  }

  try {
    if (!localStorage.getItem(ONBOARDING_KEY)) {
      showOnboarding.value = true
    }
  } catch {
    // ignore storage errors
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})

function showToast(text, type = 'success') {
  toast.value = { show: true, text, type }
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value.show = false
  }, 1200)
}



const query = computed({
  get: () => answersStore.query,
  set: (val) => {
    answersStore.setQuery(val)
    activeIndex.value = 0
  }
})

const list = computed(() => {
  const source = answersStore.filtered
  if (categoriesStore.currentId === 'all') return source
  const ids = new Set(categoriesStore.getBranchIds(categoriesStore.currentId))
  return source.filter((a) => ids.has(a.categoryId))
})

const pendingDeleteItems = computed(() => {
  if (!pendingDeleteCategory.value) return []
  return answersStore.list.filter((item) => item.categoryId === pendingDeleteCategory.value._id)
})

const pendingDeleteCount = computed(() => pendingDeleteItems.value.length)

const pendingDeletePreview = computed(() => pendingDeleteItems.value.slice(0, 3).map((item) => item.title))

const migrateTargets = computed(() => {
  if (!pendingDeleteCategory.value) return []
  return categoriesStore.list.filter((c) => c._id !== pendingDeleteCategory.value._id)
})

function moveUp() {
  if (!list.value.length) return
  activeIndex.value = activeIndex.value <= 0 ? list.value.length - 1 : activeIndex.value - 1
}

function moveDown() {
  if (!list.value.length) return
  activeIndex.value = activeIndex.value >= list.value.length - 1 ? 0 : activeIndex.value + 1
}

function onEsc() {
  if (pendingDeleteCategory.value) {
    pendingDeleteCategory.value = null
    return
  }
  if (showVarModal.value) {
    showVarModal.value = false
    return
  }
  if (showCopyAssistant.value) {
    showCopyAssistant.value = false
    return
  }
  if (query.value) {
    query.value = ''
    return
  }
  window.preload?.hideMainWindow?.()
}

function onOnboardingDone(action) {
  try { localStorage.setItem(ONBOARDING_KEY, '1') } catch { /* ignore */ }
  showOnboarding.value = false
  if (action === 'admin') router.push('/admin')
}

function onChangeInsertStrategy(value) {
  insertStrategy.value = value
  localStorage.setItem('quick-reply-insert-strategy-v1', value)
  showToast(value === 'copy' ? '已切换为置顶复制模式' : '已切换为自动插入模式')
}

function onAddCategory(name) {
  const result = categoriesStore.addCategory(name)
  if (!result.ok) {
    showToast(result.message, 'error')
    return
  }
  categoriesStore.setCurrent(result.data._id)
  showToast(`已新建分类：${result.data.name}`)
}

function onRenameCategory(payload) {
  const result = categoriesStore.renameCategory(payload.id, payload.name, payload.icon)
  if (!result.ok) {
    showToast(result.message, 'error')
    return
  }
  showToast(`分类已更新：${result.data.name}`)
}

function onMoveCategory(payload) {
  const result = categoriesStore.moveCategory(payload.id, payload.direction)
  if (!result.ok) {
    showToast(result.message, 'error')
    return
  }
}

function onDropCategory(payload) {
  const result = categoriesStore.moveCategoryByDrop(payload.dragId, payload.targetId, payload.mode)
  if (!result.ok) {
    showToast(result.message, 'error')
    return
  }
}

function onPromoteCategory(payload) {
  const result = categoriesStore.promoteCategoryToTopLevel(payload.dragId)
  if (!result.ok) {
    showToast(result.message, 'error')
    return
  }
  showToast('已升级为一级分类')
}

function onRemoveCategory(category) {
  pendingDeleteCategory.value = category

  const fallbackId = categoriesStore.getFallbackCategoryId()
  let lastTarget = ''
  try {
    lastTarget = localStorage.getItem(LAST_MIGRATE_TARGET_KEY) || ''
  } catch {
    // ignore storage errors
  }

  const isValidLastTarget =
    !!lastTarget &&
    lastTarget !== category._id &&
    categoriesStore.list.some((c) => c._id === lastTarget)

  migrateTargetId.value = isValidLastTarget ? lastTarget : fallbackId && fallbackId !== category._id ? fallbackId : ''
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
  }

  const result = categoriesStore.removeCategory(category._id)
  if (!result.ok) {
    showToast(result.message, 'error')
    return
  }

  if (categoriesStore.currentId === category._id) {
    categoriesStore.setCurrent('all')
  }

  const targetName = categoriesStore.list.find((c) => c._id === migrateTargetId.value)?.name || ''
  const catName = category.name
  if (migrateTargetId.value) {
    try { localStorage.setItem(LAST_MIGRATE_TARGET_KEY, migrateTargetId.value) } catch { /* ignore */ }
  }
  pendingDeleteCategory.value = null
  showToast(count > 0 ? `已删除分类，并迁移 ${count} 条回复到「${targetName}」` : `已删除分类「${catName}」`)
}

async function triggerCopy(answer, vars = {}) {
  // If answer has images, open CopyAssistant (user controls the copy sequence)
  if (answer.images?.length) {
    assistantAnswer.value = answer
    assistantText.value = fillVariables(answer.content || '', vars)
    showCopyAssistant.value = true
    return
  }

  // No images: copy text immediately (original flow)
  const varNames = parseVariables(answer.content || '')
  if (varNames.length > 0 && Object.keys(vars).length === 0) {
    pendingVars.value = varNames
    activeAnswer.value = answer
    showVarModal.value = true
    return
  }

  try {
    await copyFlow(answer, vars)
    copiedId.value = answer._id
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => { copiedId.value = '' }, 1200)
    showToast('复制成功')
    window.preload?.hideMainWindow?.()
  } catch {
    showToast('复制失败，请重试', 'error')
  }
}

async function onCopy(answer) {
  const varNames = parseVariables(answer.content || '')
  if (varNames.length > 0) {
    pendingVars.value = varNames
    activeAnswer.value = answer
    showVarModal.value = true
    return
  }
  await triggerCopy(answer)
}

async function onInsert(answer) {
  const vars = parseVariables(answer.content || '')
  if (vars.length > 0) {
    pendingVars.value = vars
    activeAnswer.value = { ...answer, __insertMode: true }
    showVarModal.value = true
    return
  }

  try {
    await insertFlow(answer, {}, insertStrategy.value)
    showToast('已插入到当前窗口')
  } catch (err) {
    const msg = err instanceof Error ? err.message : '插入失败'
    showToast(msg, msg.includes('已复制到剪贴板') ? 'success' : 'error')
  }
}

function onEdit(answer) {
  router.push({ path: '/admin', query: { editId: answer._id } })
}

function startResizeSidebar(e) {
  const startX = e.clientX
  const startWidth = sidebarWidth.value

  const onMove = (ev) => {
    const next = startWidth + (ev.clientX - startX)
    sidebarWidth.value = Math.min(360, Math.max(180, next))
  }

  const onUp = () => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    try {
      localStorage.setItem('quick-reply-main-sidebar-width-v1', String(sidebarWidth.value))
    } catch {
      // ignore storage errors
    }
  }

  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'col-resize'
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

async function onEnter() {
  const current = list.value[activeIndex.value]
  if (!current) return
  await onInsert(current)
}

async function onConfirmVars(values) {
  if (!activeAnswer.value) return

  const isInsertMode = !!activeAnswer.value.__insertMode

  if (isInsertMode) {
    try {
      await insertFlow(activeAnswer.value, values, insertStrategy.value)
      showVarModal.value = false
      showToast('已插入到当前窗口')
    } catch (err) {
      const msg = err instanceof Error ? err.message : '插入失败'
      showToast(msg, msg.includes('已复制到剪贴板') ? 'success' : 'error')
      return
    }
    activeAnswer.value = null
    return
  }

  showVarModal.value = false
  const answer = activeAnswer.value
  activeAnswer.value = null
  await triggerCopy(answer, values)
}
</script>

<template>
  <div class="main-layout">
    <div class="top-bar">
      <SearchBar
        id="tour-search"
        ref="searchBarRef"
        v-model="query"
        @escape="onEsc"
        @up="moveUp"
        @down="moveDown"
        @enter="onEnter"
      />
      <div class="top-actions">
        <div id="tour-strategy" class="strategy-switch" role="group" aria-label="插入策略">
          <button
            class="strategy-btn"
            :class="{ active: insertStrategy === 'copy' }"
            @click="onChangeInsertStrategy('copy')"
          >
            置顶复制
          </button>
          <button
            class="strategy-btn"
            :class="{ active: insertStrategy === 'auto' }"
            @click="onChangeInsertStrategy('auto')"
          >
            自动插入
          </button>
        </div>
        <button class="category-toggle" @click="sidebarDrawerOpen = true" title="分类">
          <Menu :size="14" />
          <span class="btn-text">分类</span>
        </button>
        <button id="tour-help" class="help-btn" title="查看教程" @click="showOnboarding = true">
          <HelpCircle :size="14" />
        </button>
        <button id="tour-admin" class="admin-btn" @click="router.push('/admin')" title="管理">
          <Settings :size="14" />
          <span class="btn-text">管理</span>
        </button>
      </div>
    </div>

    <div class="body" :style="{ '--sidebar-width': `${sidebarWidth}px` }">
      <div id="tour-categories" class="sidebar-wrap sidebar-desktop">
        <CategorySidebar class="category-panel"
          :categories="categoriesStore.list"
          :current-id="categoriesStore.currentId"
          @change="categoriesStore.setCurrent"
          @add="onAddCategory"
          @rename="onRenameCategory"
          @remove="onRemoveCategory"
          @move="onMoveCategory"
          @drop-category="onDropCategory"
          @promote-category="onPromoteCategory"
        />
        <div class="resize-handle" title="拖动调整侧栏宽度" @mousedown.prevent="startResizeSidebar" />
      </div>

      <AnswerList
        :list="list"
        :active-index="activeIndex"
        :keyword="query"
        :copied-id="copiedId"
        @copy="onCopy"
        @insert="onInsert"
        @edit="onEdit"
      >
        <template #empty-action>
          <button class="btn-copy" @click="router.push('/admin')">去添加</button>
        </template>
      </AnswerList>
    </div>

    <div v-if="sidebarDrawerOpen" class="drawer-mask" @click="sidebarDrawerOpen = false">
      <div class="drawer-panel" @click.stop>
        <div class="drawer-head">
          <strong>分类</strong>
          <button class="btn-ghost" @click="sidebarDrawerOpen = false">关闭</button>
        </div>
        <CategorySidebar
          :categories="categoriesStore.list"
          :current-id="categoriesStore.currentId"
          @change="(id) => { categoriesStore.setCurrent(id); sidebarDrawerOpen = false }"
          @add="onAddCategory"
          @rename="onRenameCategory"
          @remove="onRemoveCategory"
          @move="onMoveCategory"
          @drop-category="onDropCategory"
          @promote-category="onPromoteCategory"
        />
      </div>
    </div>

    <VarFillModal
      :show="showVarModal"
      :variables="pendingVars"
      @confirm="onConfirmVars"
      @cancel="showVarModal = false"
    />

    <CopyAssistant
      :show="showCopyAssistant"
      :answer="assistantAnswer"
      :filled-text="assistantText"
      @close="showCopyAssistant = false"
    />

    <div v-if="pendingDeleteCategory" class="confirm-mask">
      <div class="confirm-card">
        <h3>确认删除分类</h3>

        <template v-if="pendingDeleteCount > 0">
          <p>
            将删除「{{ pendingDeleteCategory.name }}」，并把
            <strong>{{ pendingDeleteCount }}</strong>
            条回复迁移到：
          </p>
          <div v-if="pendingDeletePreview.length" class="preview-box">
            <div class="preview-title">受影响回复预览：</div>
            <ul>
              <li v-for="title in pendingDeletePreview" :key="title">{{ title }}</li>
            </ul>
            <div v-if="pendingDeleteCount > 3" class="preview-more">... 还有 {{ pendingDeleteCount - 3 }} 条</div>
          </div>
          <select v-model="migrateTargetId" class="target-select">
            <option v-for="target in migrateTargets" :key="target._id" :value="target._id">
              {{ target.icon }} {{ target.name }}
            </option>
          </select>
        </template>

        <template v-else>
          <p class="muted">「{{ pendingDeleteCategory.name }}」是空分类，确认删除？</p>
        </template>

        <div class="confirm-actions">
          <button class="btn-danger" @click="confirmRemoveCategory">确认删除</button>
          <button class="btn-ghost" @click="pendingDeleteCategory = null">取消</button>
        </div>
      </div>
    </div>

    <transition name="fade">
      <div v-if="toast.show" class="toast" :class="{ error: toast.type === 'error' }">{{ toast.text }}</div>
    </transition>

    <OnboardingModal v-if="showOnboarding" @done="onOnboardingDone" />
  </div>
</template>

<style scoped>
.main-layout {
  padding: 12px;
  height: 100vh;
  box-sizing: border-box;
  background: var(--bg-base);
  color: var(--text-primary);
}
.top-bar {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  margin-bottom: 10px;
  align-items: center;
}
.top-actions {
  display: inline-flex;
  gap: 8px;
  align-items: center;
}

.api-badge {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 8px;
  border-radius: 12px;
  border: 1px solid rgba(239, 68, 68, 0.35);
  background: rgba(239, 68, 68, 0.12);
  color: #f87171;
  font-size: 11px;
  white-space: nowrap;
}

.api-badge.ok {
  border-color: rgba(16, 185, 129, 0.35);
  background: rgba(16, 185, 129, 0.12);
  color: #34d399;
}

.strategy-switch {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-surface);
  overflow: hidden;
  height: 44px;
}

.strategy-btn {
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  padding: 0 10px;
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
}

.strategy-btn.active {
  background: var(--accent-soft);
  color: var(--accent);
}

.category-toggle,
.help-btn {
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--text-muted);
  border-radius: 6px;
  width: 36px; height: 44px;
  display: inline-flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
  flex-shrink: 0;
}
.help-btn:hover { color: var(--accent); border-color: rgba(59,130,246,0.4); background: rgba(59,130,246,0.06); }
.admin-btn {
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--text-primary);
  border-radius: 6px;
  padding: 0 12px;
  height: 44px;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.category-toggle {
  display: none;
}

.btn-icon {
  font-size: 13px;
  line-height: 1;
}

.btn-text {
  line-height: 1;
}

.body {
  display: grid;
  grid-template-columns: minmax(180px, var(--sidebar-width, 220px)) 1fr;
  gap: 10px;
  height: calc(100% - 54px);
  min-height: 0;
}
.sidebar-wrap {
  position: relative;
  min-width: 0;
  min-height: 0;
}
.sidebar-desktop {
  display: block;
}
.category-panel {
  height: 100%;
  box-sizing: border-box;
}
.resize-handle {
  position: absolute;
  top: 0;
  right: -6px;
  width: 12px;
  height: 100%;
  cursor: col-resize;
  z-index: 5;
}
.resize-handle::after {
  content: '';
  position: absolute;
  left: 5px;
  top: 0;
  width: 2px;
  height: 100%;
  background: transparent;
  transition: background 0.15s ease;
}
.resize-handle:hover::after {
  background: var(--accent);
}
.drawer-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: grid;
  justify-items: start;
  z-index: 20;
}
.drawer-panel {
  width: min(280px, 82vw);
  height: 100%;
  background: var(--bg-base);
  border-right: 1px solid var(--border);
  padding: 10px;
  box-sizing: border-box;
}
.drawer-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.btn-ghost {
  border: 0;
  border-radius: 4px;
  padding: 6px 10px;
  cursor: pointer;
  background: var(--bg-hover);
  color: var(--text-primary);
}
.btn-copy {
  padding: 4px 12px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}
.btn-copy:hover {
  background: var(--accent-hover);
}
.confirm-mask {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.35);
}
.confirm-card {
  width: min(420px, 90vw);
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-elevated);
  padding: 14px;
}
.confirm-card p {
  color: var(--text-secondary);
}
.preview-box {
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-surface);
  padding: 8px;
  margin-bottom: 8px;
  color: var(--text-secondary);
  font-size: 12px;
}

.preview-title {
  color: var(--text-primary);
  margin-bottom: 4px;
}

.preview-box ul {
  margin: 0;
  padding-left: 16px;
}

.preview-more {
  margin-top: 4px;
  color: var(--text-muted);
}

.target-select {
  width: 100%;
  margin-bottom: 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-surface);
  color: var(--text-primary);
  padding: 6px 8px;
}
.confirm-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.btn-danger,
.btn-ghost {
  border: 0;
  border-radius: 4px;
  padding: 6px 10px;
  cursor: pointer;
}
.btn-danger {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}
.btn-ghost {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.toast {
  position: fixed;
  right: 16px;
  bottom: 16px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  background: var(--success-soft);
  color: var(--success);
  border-radius: 6px;
  font-size: 12px;
}
.toast.error {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 760px) {
  .top-bar {
    grid-template-columns: 1fr auto;
    gap: 6px;
    margin-bottom: 8px;
  }

  .top-actions {
    gap: 6px;
  }

  .strategy-switch {
    height: 40px;
  }

  .strategy-btn {
    padding: 0 8px;
    font-size: 11px;
  }

  .category-toggle,
  .admin-btn {
    height: 40px;
    padding: 0 10px;
    font-size: 12px;
  }

  .body {
    grid-template-columns: minmax(150px, var(--sidebar-width, 220px)) 1fr;
  }
}

@media (max-width: 620px) {
  .main-layout {
    padding: 8px;
  }

  .top-bar {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .top-actions {
    justify-content: space-between;
    width: 100%;
  }

  .category-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 72px;
  }

  .admin-btn {
    min-width: 72px;
  }

  .btn-text {
    display: none;
  }

  .body {
    grid-template-columns: 1fr;
    height: calc(100% - 92px);
  }

  .sidebar-desktop {
    display: none;
  }

  .toast {
    right: 8px;
    bottom: 8px;
  }
}
</style>
