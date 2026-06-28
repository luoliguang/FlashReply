<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  categories: { type: Array, default: () => [] },
  currentId: { type: String, default: 'all' },
  enableDropAnswer: { type: Boolean, default: false }
})

const emit = defineEmits(['change', 'add', 'rename', 'remove', 'move', 'drop-category', 'drop-answer'])

const creating = ref(false)
const newName = ref('')
const parentId = ref('')
const editingId = ref('')
const editingName = ref('')
const expandedId = ref('')
const draggingId = ref('')
const dropTarget = ref({ id: '', mode: '' })

const topLevelCategories = computed(() => props.categories.filter((cat) => !cat.parentId))

function childrenOf(id) {
  return props.categories.filter((cat) => cat.parentId === id)
}

function openCreate(pid = '') {
  creating.value = true
  newName.value = ''
  parentId.value = pid
}

function cancelCreate() {
  creating.value = false
  newName.value = ''
  parentId.value = ''
}

function confirmCreate() {
  emit('add', { name: newName.value, parentId: parentId.value })
  cancelCreate()
}

function startEdit(cat) {
  editingId.value = cat._id
  editingName.value = cat.name
  expandedId.value = ''
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
  if (expandedId.value === id) {
    expandedId.value = ''
    return
  }
  expandedId.value = id
}

function selectCategory(cat) {
  emit('change', cat._id)
}

function categoryLabel(cat) {
  return `${cat.icon} ${cat.name}`
}

function onDragStart(cat, e) {
  draggingId.value = cat._id
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', cat._id)
}

function onDragOver(cat, mode, e) {
  const dragType = e.dataTransfer.getData('application/x-quick-reply-drag-type')
  if (dragType === 'answer' && props.enableDropAnswer) {
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
    if (answerId) {
      emit('drop-answer', { answerId, targetCategoryId: cat._id })
    }
    clearDragState()
    return
  }

  const dragId = draggingId.value || e.dataTransfer.getData('text/plain')
  if (!dragId || dragId === cat._id) {
    clearDragState()
    return
  }
  emit('drop-category', { dragId, targetId: cat._id, mode })
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
      <button class="btn-add" @click="openCreate('')">+ 一级</button>
    </div>

    <div v-if="creating" class="create-row">
      <div class="create-hint">{{ parentId ? '新建二级分类' : '新建一级分类' }}</div>
      <input
        v-model="newName"
        class="create-input"
        :placeholder="parentId ? '输入二级分类名' : '输入一级分类名'"
        @keydown.enter.prevent="confirmCreate"
        @keydown.esc.prevent="cancelCreate"
      />
      <div class="create-actions">
        <button class="btn-ok" @click="confirmCreate">确定</button>
        <button class="btn-cancel" @click="cancelCreate">取消</button>
      </div>
    </div>

    <div class="category-item all" :class="{ active: currentId === 'all' }" @click="emit('change', 'all')">
      <span class="category-text">全部</span>
    </div>

    <div v-for="(cat, idx) in topLevelCategories" :key="cat._id" class="category-row">
      <template v-if="editingId === cat._id">
        <input
          v-model="editingName"
          class="edit-input"
          @keydown.enter.prevent="confirmEdit(cat._id)"
          @keydown.esc.prevent="cancelEdit"
        />
        <div class="edit-actions">
          <button class="btn-ok" @click="confirmEdit(cat._id)">✓</button>
          <button class="btn-cancel" @click="cancelEdit">✕</button>
        </div>
      </template>

      <template v-else>
        <div
          class="drop-zone"
          :class="{ active: dropClass(cat._id, 'after') }"
          @dragover="onDragOver(cat, 'after', $event)"
          @drop="onDrop(cat, 'after', $event)"
        />

        <div
          class="category-item"
          :class="{ active: currentId === cat._id, dragging: draggingId === cat._id }"
          draggable="true"
          @dragstart="onDragStart(cat, $event)"
          @dragend="clearDragState"
          @dragover.prevent="onDragOver(cat, 'inside', $event)"
          @drop="onDrop(cat, 'inside', $event)"
          @click="selectCategory(cat)"
        >
          <span class="category-text" :title="categoryLabel(cat)">{{ categoryLabel(cat) }}</span>
          <div class="category-actions-inline">
            <button class="btn-expand" @click.stop="toggleExpand(cat._id)">⋯</button>
          </div>
        </div>

        <div v-if="expandedId === cat._id" class="row-actions">
          <button class="btn-mini" :disabled="idx === 0" title="上移" @click="moveCategory(cat, 'up')">↑</button>
          <button
            class="btn-mini"
            :disabled="idx === topLevelCategories.length - 1"
            title="下移"
            @click="moveCategory(cat, 'down')"
          >
            ↓
          </button>
          <button class="btn-mini" title="新增二级" @click="openCreate(cat._id)">+2级</button>
          <button class="btn-mini" title="编辑" @click="startEdit(cat)">✏</button>
          <button class="btn-mini danger" title="删除" @click="removeCategory(cat)">🗑</button>
        </div>

        <div class="children">
          <div v-for="sub in childrenOf(cat._id)" :key="sub._id" class="child-row">
            <template v-if="editingId === sub._id">
              <input
                v-model="editingName"
                class="edit-input"
                @keydown.enter.prevent="confirmEdit(sub._id)"
                @keydown.esc.prevent="cancelEdit"
              />
              <div class="edit-actions">
                <button class="btn-ok" @click="confirmEdit(sub._id)">✓</button>
                <button class="btn-cancel" @click="cancelEdit">✕</button>
              </div>
            </template>
            <template v-else>
              <div
                class="drop-zone"
                :class="{ active: dropClass(sub._id, 'after') || dropClass(sub._id, 'inside') }"
                @dragover.prevent="onDragOver(sub, 'inside', $event)"
                @drop="onDrop(sub, 'inside', $event)"
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
                  <button class="btn-expand" @click.stop="toggleExpand(sub._id)">⋯</button>
                </div>
              </div>

              <div v-if="expandedId === sub._id" class="row-actions sub-actions">
                <button class="btn-mini" title="上移" @click="moveCategory(sub, 'up')">↑</button>
                <button class="btn-mini" title="下移" @click="moveCategory(sub, 'down')">↓</button>
                <button class="btn-mini" title="编辑" @click="startEdit(sub)">✏</button>
                <button class="btn-mini danger" title="删除" @click="removeCategory(sub)">🗑</button>
              </div>
            </template>
          </div>
        </div>
      </template>
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
}

.sidebar-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  color: var(--text-secondary);
  font-size: 12px;
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
  margin-bottom: 8px;
  display: grid;
  gap: 6px;
}

.create-hint {
  color: var(--text-muted);
  font-size: 12px;
}

.create-input,
.edit-input {
  width: 100%;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-primary);
  border-radius: 4px;
  padding: 6px 8px;
  font-size: 12px;
}

.create-actions,
.edit-actions,
.row-actions {
  display: flex;
  gap: 6px;
  margin: 6px 0 8px;
  justify-content: flex-end;
}

.row-actions.sub-actions {
  padding-left: 8px;
}

.category-row {
  margin-bottom: 4px;
}

.category-item {
  width: 100%;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 13px;
  transition: all 0.1s;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  border: 1px solid transparent;
}

.category-item.dragging {
  opacity: 0.55;
}

.category-item.all {
  margin-bottom: 4px;
}

.category-item.child {
  padding-left: 12px;
}

.children {
  padding-left: 10px;
  border-left: 1px dashed var(--border);
  margin-left: 8px;
}

.child-row {
  margin-top: 4px;
}

.category-actions-inline {
  display: inline-flex;
  gap: 4px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.category-item:hover .category-actions-inline,
.category-item.active .category-actions-inline,
.row-actions {
  opacity: 1;
  pointer-events: auto;
}

.category-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-expand {
  flex-shrink: 0;
  padding: 2px 8px;
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

.drop-zone {
  height: 6px;
  border-radius: 4px;
  margin: 1px 0;
}

.drop-zone.active {
  background: color-mix(in oklab, var(--accent) 70%, transparent 30%);
}
</style>
