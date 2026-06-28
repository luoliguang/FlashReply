<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { MoreHorizontal, ChevronUp, ChevronDown, Plus, Pencil, Trash2, Check, X } from 'lucide-vue-next'

const props = defineProps({
  categories: { type: Array, default: () => [] },
  currentId: { type: String, default: 'all' },
  enableDropAnswer: { type: Boolean, default: false }
})

const emit = defineEmits(['change', 'add', 'rename', 'remove', 'move', 'drop-category', 'drop-answer', 'promote-category'])

// null = not creating; '' = creating top-level; 'cat_xxx' = creating child under this id
const creatingParentId = ref(null)
const newName = ref('')
const createInputRef = ref(null)

const editingId = ref('')
const editingName = ref('')
const editInputRef = ref(null)

const expandedId = ref('')
const draggingId = ref('')
const dropTarget = ref({ id: '', mode: '' })

const topLevelCategories = computed(() => props.categories.filter((cat) => !cat.parentId))

// True when the item being dragged is a child category
const isDraggingChild = computed(() => {
  if (!draggingId.value) return false
  return !!props.categories.find((c) => c._id === draggingId.value)?.parentId
})

function childrenOf(id) {
  return props.categories.filter((cat) => cat.parentId === id)
}

function openCreate(pid) {
  creatingParentId.value = pid
  newName.value = ''
  expandedId.value = ''
}

function cancelCreate() {
  creatingParentId.value = null
  newName.value = ''
}

function confirmCreate() {
  const name = newName.value.trim()
  if (!name) return
  emit('add', { name, parentId: creatingParentId.value || '' })
  cancelCreate()
}

// Auto-focus create input when it appears
watch(creatingParentId, (val) => {
  if (val !== null) nextTick(() => createInputRef.value?.focus())
})

function startEdit(cat) {
  editingId.value = cat._id
  editingName.value = cat.name
  expandedId.value = ''
  nextTick(() => editInputRef.value?.focus())
}

function cancelEdit() {
  editingId.value = ''
  editingName.value = ''
}

function confirmEdit(id) {
  emit('rename', { id, name: editingName.value })
  cancelEdit()
}

function removeCategory(cat) {
  emit('remove', cat)
  expandedId.value = ''
}

function moveCategory(cat, direction) {
  emit('move', { id: cat._id, direction })
  expandedId.value = ''
}

function toggleExpand(id) {
  expandedId.value = expandedId.value === id ? '' : id
}

function selectCategory(cat) {
  emit('change', cat._id)
  expandedId.value = ''
}

function categoryLabel(cat) {
  return `${cat.icon} ${cat.name}`
}

// ── Drag & Drop ───────────────────────────────────────────────────────────────

function onDragStart(cat, e) {
  draggingId.value = cat._id
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', cat._id)
  // Required for Chrome to expose type keys during dragover
  e.dataTransfer.setData('application/x-quick-reply-cat-id', cat._id)
}

function onDragOver(cat, mode, e) {
  // Chrome blocks getData during dragover — use types array instead
  const isAnswerDrag = e.dataTransfer.types.includes('application/x-quick-reply-drag-type')
  if (isAnswerDrag && props.enableDropAnswer) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    dropTarget.value = { id: cat._id, mode: 'inside' }
    return
  }

  if (!draggingId.value || draggingId.value === cat._id) return
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  dropTarget.value = { id: cat._id, mode }
}

function onDrop(cat, mode, e) {
  e.preventDefault()

  const type = e.dataTransfer.getData('application/x-quick-reply-drag-type')
  if (type === 'answer' && props.enableDropAnswer) {
    const answerId = e.dataTransfer.getData('application/x-quick-reply-answer-id')
    if (answerId) emit('drop-answer', { answerId, targetCategoryId: cat._id })
    clearDragState()
    return
  }

  const dragId = draggingId.value || e.dataTransfer.getData('text/plain')
  if (!dragId || dragId === cat._id) { clearDragState(); return }
  emit('drop-category', { dragId, targetId: cat._id, mode })
  clearDragState()
}

// Drop zone at the bottom of the list: promotes a child to top-level
function onDragOverPromote(e) {
  if (!draggingId.value) return
  const isCatDrag = e.dataTransfer.types.includes('application/x-quick-reply-cat-id')
  if (!isCatDrag) return
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  dropTarget.value = { id: '__promote__', mode: 'promote' }
}

function onDropPromote(e) {
  e.preventDefault()
  const dragId = draggingId.value || e.dataTransfer.getData('text/plain')
  if (!dragId) { clearDragState(); return }
  emit('promote-category', { dragId })
  clearDragState()
}

function clearDragState() {
  draggingId.value = ''
  dropTarget.value = { id: '', mode: '' }
}

function dropClass(catId, mode) {
  return dropTarget.value.id === catId && dropTarget.value.mode === mode
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-head">
      <span>分类</span>
      <button class="btn-add" title="新建一级分类" @click="openCreate('')">
        <Plus :size="12" />一级
      </button>
    </div>

    <!-- "全部" 入口 -->
    <div class="category-item all" :class="{ active: currentId === 'all' }" @click="emit('change', 'all')">
      <span class="category-text">全部</span>
    </div>

    <!-- 一级分类列表 -->
    <div v-for="(cat, idx) in topLevelCategories" :key="cat._id" class="category-row">

      <!-- 拖拽插入线（同级排序 / 子升父） -->
      <div
        class="drop-zone"
        :class="{ active: dropClass(cat._id, 'after') }"
        @dragover="onDragOver(cat, 'after', $event)"
        @dragleave="dropTarget.id === cat._id && (dropTarget = { id: '', mode: '' })"
        @drop="onDrop(cat, 'after', $event)"
      />

      <!-- 编辑模式 -->
      <template v-if="editingId === cat._id">
        <input
          ref="editInputRef"
          v-model="editingName"
          class="edit-input"
          @keydown.enter.prevent="confirmEdit(cat._id)"
          @keydown.esc.prevent="cancelEdit"
        />
        <div class="edit-actions">
          <button class="btn-ok" @click="confirmEdit(cat._id)"><Check :size="12" /></button>
          <button class="btn-cancel" @click="cancelEdit"><X :size="12" /></button>
        </div>
      </template>

      <!-- 正常模式 -->
      <template v-else>
        <div
          class="category-item"
          :class="{ active: currentId === cat._id, dragging: draggingId === cat._id, 'drop-inside': dropClass(cat._id, 'inside') }"
          draggable="true"
          @dragstart="onDragStart(cat, $event)"
          @dragend="clearDragState"
          @dragover.prevent="onDragOver(cat, 'inside', $event)"
          @drop="onDrop(cat, 'inside', $event)"
          @click="selectCategory(cat)"
        >
          <span class="category-text" :title="categoryLabel(cat)">{{ categoryLabel(cat) }}</span>
          <div class="category-actions-inline">
            <!-- 快速添加子分类 -->
            <button class="btn-expand" title="新增子分类" @click.stop="openCreate(cat._id)">
              <Plus :size="12" />
            </button>
            <button class="btn-expand" title="更多操作" @click.stop="toggleExpand(cat._id)">
              <MoreHorizontal :size="13" />
            </button>
          </div>
        </div>

        <!-- 展开操作菜单 -->
        <div v-if="expandedId === cat._id" class="row-actions">
          <button class="btn-mini" :disabled="idx === 0" title="上移" @click="moveCategory(cat, 'up')">
            <ChevronUp :size="13" />
          </button>
          <button class="btn-mini" :disabled="idx === topLevelCategories.length - 1" title="下移" @click="moveCategory(cat, 'down')">
            <ChevronDown :size="13" />
          </button>
          <button class="btn-mini" title="重命名" @click="startEdit(cat)">
            <Pencil :size="12" />
          </button>
          <button class="btn-mini danger" title="删除" @click="removeCategory(cat)">
            <Trash2 :size="12" />
          </button>
        </div>

        <!-- 子分类列表 -->
        <div v-if="childrenOf(cat._id).length || creatingParentId === cat._id" class="children">
          <div v-for="sub in childrenOf(cat._id)" :key="sub._id" class="child-row">
            <!-- 编辑模式 -->
            <template v-if="editingId === sub._id">
              <input
                ref="editInputRef"
                v-model="editingName"
                class="edit-input"
                @keydown.enter.prevent="confirmEdit(sub._id)"
                @keydown.esc.prevent="cancelEdit"
              />
              <div class="edit-actions">
                <button class="btn-ok" @click="confirmEdit(sub._id)"><Check :size="12" /></button>
                <button class="btn-cancel" @click="cancelEdit"><X :size="12" /></button>
              </div>
            </template>
            <template v-else>
              <div
                class="drop-zone"
                :class="{ active: dropClass(sub._id, 'after') }"
                @dragover.prevent="onDragOver(sub, 'after', $event)"
                @drop="onDrop(sub, 'after', $event)"
              />
              <div
                class="category-item child"
                :class="{ active: currentId === sub._id, dragging: draggingId === sub._id }"
                draggable="true"
                @dragstart="onDragStart(sub, $event)"
                @dragend="clearDragState"
                @dragover.prevent="onDragOver(sub, 'inside', $event)"
                @drop="onDrop(sub, 'inside', $event)"
                @click="selectCategory(sub)"
              >
                <span class="category-text" :title="categoryLabel(sub)">{{ categoryLabel(sub) }}</span>
                <div class="category-actions-inline">
                  <button class="btn-expand" title="更多操作" @click.stop="toggleExpand(sub._id)">
                    <MoreHorizontal :size="13" />
                  </button>
                </div>
              </div>

              <div v-if="expandedId === sub._id" class="row-actions sub-actions">
                <button class="btn-mini" title="上移" @click="moveCategory(sub, 'up')"><ChevronUp :size="13" /></button>
                <button class="btn-mini" title="下移" @click="moveCategory(sub, 'down')"><ChevronDown :size="13" /></button>
                <button class="btn-mini" title="重命名" @click="startEdit(sub)"><Pencil :size="12" /></button>
                <button class="btn-mini danger" title="删除" @click="removeCategory(sub)"><Trash2 :size="12" /></button>
              </div>
            </template>
          </div>

          <!-- 新建子分类：表单紧跟在该父级下面 -->
          <div v-if="creatingParentId === cat._id" class="create-row child-create">
            <input
              ref="createInputRef"
              v-model="newName"
              class="create-input"
              placeholder="子分类名称"
              @keydown.enter.prevent="confirmCreate"
              @keydown.esc.prevent="cancelCreate"
            />
            <div class="create-actions">
              <button class="btn-ok" @click="confirmCreate"><Check :size="12" /></button>
              <button class="btn-cancel" @click="cancelCreate"><X :size="12" /></button>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- 新建一级分类：表单在列表底部 -->
    <div v-if="creatingParentId === ''" class="create-row">
      <input
        ref="createInputRef"
        v-model="newName"
        class="create-input"
        placeholder="一级分类名称"
        @keydown.enter.prevent="confirmCreate"
        @keydown.esc.prevent="cancelCreate"
      />
      <div class="create-actions">
        <button class="btn-ok" @click="confirmCreate"><Check :size="12" /></button>
        <button class="btn-cancel" @click="cancelCreate"><X :size="12" /></button>
      </div>
    </div>

    <!-- 子升父拖拽落区：拖动时才出现 -->
    <div
      class="promote-zone"
      :class="{ visible: isDraggingChild, active: dropTarget.id === '__promote__' }"
      @dragover="onDragOverPromote"
      @dragleave="dropTarget.id === '__promote__' && (dropTarget = { id: '', mode: '' })"
      @drop="onDropPromote"
    >
      <Plus :size="12" />拖至此处升为一级
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  border: 1px solid var(--border);
  background: var(--bg-surface);
  border-radius: 6px;
  padding: 8px;
  overflow: auto;
  display: flex;
  flex-direction: column;
}

.sidebar-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  color: var(--text-secondary);
  font-size: 12px;
  flex-shrink: 0;
}

.btn-add,
.btn-ok,
.btn-cancel,
.btn-mini,
.btn-expand {
  border: 0;
  border-radius: 4px;
  padding: 3px 8px;
  cursor: pointer;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  line-height: 1;
}

.btn-add,
.btn-ok {
  background: var(--accent-soft);
  color: var(--accent);
}

.btn-cancel,
.btn-mini,
.btn-expand {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.btn-mini.danger {
  color: #f87171;
}

.btn-mini:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.create-row {
  margin-top: 4px;
  display: grid;
  gap: 4px;
}

.child-create {
  margin-top: 4px;
  padding-left: 4px;
}

.create-input,
.edit-input {
  width: 100%;
  border: 1px solid var(--accent);
  background: var(--bg-elevated);
  color: var(--text-primary);
  border-radius: 4px;
  padding: 5px 8px;
  font-size: 12px;
  box-sizing: border-box;
  outline: none;
}

.create-actions,
.edit-actions,
.row-actions {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
}

.row-actions {
  margin: 2px 0 4px;
}

.row-actions.sub-actions {
  padding-left: 8px;
}

.category-row {
  margin-bottom: 2px;
}

.category-item {
  width: 100%;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 13px;
  transition: background 0.1s, color 0.1s;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  border: 1px solid transparent;
  box-sizing: border-box;
}

.category-item.dragging {
  opacity: 0.5;
}

.category-item.drop-inside {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.category-item.all {
  margin-bottom: 4px;
}

.category-item.child {
  padding-left: 10px;
}

.children {
  padding-left: 10px;
  border-left: 1px dashed var(--border);
  margin-left: 10px;
  margin-top: 2px;
}

.child-row {
  margin-top: 2px;
}

.category-actions-inline {
  display: inline-flex;
  gap: 2px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s ease;
  flex-shrink: 0;
}

.category-item:hover .category-actions-inline,
.category-item.active .category-actions-inline {
  opacity: 1;
  pointer-events: auto;
}

.category-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.btn-expand {
  flex-shrink: 0;
  padding: 2px 6px;
}

.category-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.category-item.active {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 500;
}

/* 同级排序拖拽指示线 */
.drop-zone {
  height: 4px;
  border-radius: 4px;
  margin: 1px 0;
  transition: background 0.1s;
}

.drop-zone.active {
  background: var(--accent);
  height: 3px;
  box-shadow: 0 0 0 2px var(--accent-soft);
}

/* 子升父落区：平时不可见，拖动子分类时出现 */
.promote-zone {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 0;
  overflow: hidden;
  border-radius: 4px;
  font-size: 11px;
  color: var(--text-muted);
  border: 1px dashed transparent;
  margin-top: 0;
  transition: height 0.15s ease, border-color 0.15s ease, background 0.15s ease, margin-top 0.15s ease;
  cursor: default;
}

.promote-zone.visible {
  height: 30px;
  border-color: var(--border);
  margin-top: 6px;
}

.promote-zone.active {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
}
</style>
