<script setup>
import { computed, ref, watch, onBeforeUnmount, nextTick } from 'vue'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { parseVariables } from '../utils/variables'

const TITLE_MAX_LENGTH = 60

const props = defineProps({
  show: { type: Boolean, default: false },
  categories: { type: Array, default: () => [] },
  modelValue: {
    type: Object,
    default: () => ({ title: '', categoryId: 'cat_default', tags: [], content: '', images: [] })
  }
})

const emit = defineEmits(['save', 'cancel'])

const form = ref({ ...props.modelValue })
const dragOver = ref(false)
const error = ref('')

// Keep categoryId valid whenever categories list changes (e.g. on first load)
watch(
  () => props.categories,
  (cats) => {
    if (!cats.length) return
    const valid = cats.some((c) => c._id === form.value.categoryId)
    if (!valid) form.value.categoryId = cats[0]._id
  },
  { immediate: true }
)

function escapeHtml(text = '') {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function textToEditorHtml(text = '') {
  const lines = String(text).replace(/\r\n/g, '\n').split('\n')
  if (!lines.length) return '<p></p>'
  return lines.map((line) => `<p>${line ? escapeHtml(line) : '<br>'}</p>`).join('')
}

function editorToText(editorInstance) {
  const text = editorInstance.state.doc.textBetween(0, editorInstance.state.doc.content.size, '\n')
  return text.replace(/\r\n/g, '\n')
}

const editor = useEditor({
  extensions: [StarterKit],
  content: '<p></p>',
  editorProps: {
    attributes: {
      class: 'editor-content'
    }
  },
  onUpdate: ({ editor: current }) => {
    form.value.content = editorToText(current)
  }
})

watch(
  () => props.modelValue,
  (val) => {
    error.value = ''
    form.value = {
      ...val,
      tags: Array.isArray(val.tags) ? [...val.tags] : [],
      images: Array.isArray(val.images) ? [...val.images] : []
    }

    if (editor.value) {
      const text = String(form.value.content || '').replace(/\r\n/g, '\n')
      if (editorToText(editor.value) !== text) {
        editor.value.commands.setContent(textToEditorHtml(text), false)
      }
    }
  },
  { immediate: true }
)

watch(
  () => props.show,
  (val) => {
    if (val && editor.value) {
      editor.value.commands.focus('end')
    }
  }
)

onBeforeUnmount(() => {
  editor.value?.destroy()
})

const parsedVars = computed(() => parseVariables(form.value.content || ''))

function addTag(e) {
  if (e.key !== 'Enter') return
  const value = e.target.value.trim()
  if (!value) return
  if (!form.value.tags.includes(value)) form.value.tags.push(value)
  e.target.value = ''
}

function removeTag(tag) {
  form.value.tags = form.value.tags.filter((t) => t !== tag)
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function compressImage(file, quality = 0.75) {
  return new Promise((resolve) => {
    const img = new Image()
    img.src = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', quality)
    }
  })
}

async function appendFiles(fileList) {
  const files = Array.from(fileList || [])
  for (const file of files) {
    const nextFile = file.size > 300 * 1024 ? await compressImage(file, 0.7) : file
    const dataUrl = await fileToDataUrl(nextFile)
    form.value.images.push({
      id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: file.name,
      dataUrl
    })
  }
}

async function onImageSelect(e) {
  await appendFiles(e.target.files)
}

async function onDrop(e) {
  e.preventDefault()
  dragOver.value = false
  await appendFiles(e.dataTransfer?.files)
}

function onDragOver(e) {
  e.preventDefault()
  dragOver.value = true
}

function onDragLeave() {
  dragOver.value = false
}

function wrapVar(v) { return '{{' + v + '}}' }

function removeImage(id) {
  form.value.images = form.value.images.filter((img) => img.id !== id)
}

function onSave() {
  const title = String(form.value.title || '').trim()
  const content = String(form.value.content || '').trim()

  if (!title) { error.value = '标题不能为空'; return }
  if (title.length > TITLE_MAX_LENGTH) { error.value = `标题不能超过 ${TITLE_MAX_LENGTH} 个字符`; return }
  if (!content) { error.value = '内容不能为空'; return }
  if (!props.categories.length) { error.value = '请先在管理界面创建至少一个分类'; return }
  if (!props.categories.some((c) => c._id === form.value.categoryId)) {
    error.value = '请选择一个有效的分类'
    return
  }

  error.value = ''
  emit('save', { ...form.value, title, content, variables: parsedVars.value })
}
</script>

<template>
  <Teleport to="body">
  <div v-if="show" class="mask" @click.self="emit('cancel')">
    <div class="modal" tabindex="0" @keydown.esc.prevent="emit('cancel')">

      <!-- 标题栏 -->
      <div class="modal-header">
        <span class="modal-title">{{ props.modelValue?._id ? '编辑回复' : '新建回复' }}</span>
        <button class="close-btn" @click="emit('cancel')">×</button>
      </div>

      <!-- 标题字段 -->
      <div class="input-field field-first" :class="{ 'has-content': !!form.title?.trim() }">
        <span class="field-label">标题</span>
        <input v-model="form.title" class="input floating" />
      </div>

      <!-- 分类 -->
      <div v-if="!props.categories.length" class="no-category-tip">
        尚未创建任何分类，请先前往管理界面添加分类后再创建回复。
      </div>
      <div v-else class="select-field">
        <span class="select-label">分类</span>
        <select v-model="form.categoryId" class="input select-input">
          <option v-for="cat in props.categories" :key="cat._id" :value="cat._id">
            {{ cat.level === 2 ? '└ ' : '' }}{{ cat.icon }} {{ cat.name }}
          </option>
        </select>
      </div>

      <!-- 内容编辑器 -->
      <div class="editor-field" :class="{ 'has-content': !!form.content?.trim() }">
        <span class="field-label">内容</span>
        <div class="editor-wrap">
          <EditorContent :editor="editor" />
        </div>
      </div>

      <!-- 变量识别 -->
      <div class="vars-row">
        <span class="vars-label">已识别变量</span>
        <span v-if="!parsedVars.length" class="vars-empty">无</span>
        <span v-for="v in parsedVars" :key="v" class="var-chip">{{ wrapVar(v) }}</span>
      </div>

      <!-- 标签 -->
      <div class="tags-section">
        <div class="tags-chips">
          <span v-for="tag in form.tags" :key="tag" class="tag-chip" @click="removeTag(tag)">
            {{ tag }}<span class="tag-remove">×</span>
          </span>
        </div>
        <input class="input tag-input" placeholder="输入标签，回车添加" @keydown="addTag" />
      </div>

      <!-- 图片上传 -->
      <div class="upload" :class="{ over: dragOver }" @drop="onDrop" @dragover="onDragOver" @dragleave="onDragLeave">
        <span class="upload-icon">🖼</span>
        <span>拖拽图片到此，或</span>
        <label class="pick">
          点击选择
          <input type="file" accept="image/*" multiple hidden @change="onImageSelect" />
        </label>
      </div>

      <div v-if="form.images.length" class="img-list">
        <div v-for="img in form.images" :key="img.id" class="img-item">
          <img :src="img.dataUrl" :alt="img.name" />
          <button class="img-remove" @click="removeImage(img.id)">×</button>
        </div>
      </div>

      <!-- 错误提示 + 操作按钮 -->
      <div class="footer">
        <span class="error">{{ error }}</span>
        <div class="actions">
          <button class="btn ghost" @click="emit('cancel')">取消</button>
          <button class="btn primary" @click="onSave">保存</button>
        </div>
      </div>

    </div>
  </div>
  </Teleport>
</template>

<style scoped>
/* ── 遮罩 & 弹窗容器 ─────────────────────────────────── */
.mask {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(3px);
  display: grid; place-items: center;
  z-index: 100;
}
.modal {
  width: min(680px, 94vw);
  max-height: 90vh;
  overflow-y: auto;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* ── 标题栏 ──────────────────────────────────────────── */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 24px 16px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.modal-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}
.close-btn {
  width: 28px; height: 28px;
  border: none; border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 18px; line-height: 1;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.1s, color 0.1s;
}
.close-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

/* ── 表单主体 ─────────────────────────────────────────── */
.modal > .input-field { padding: 0 24px; }
.modal > .input-field.field-first { padding-top: 20px; }
.modal > .editor-field { padding: 0 24px; }

/* ── 浮动 Label 字段 ─────────────────────────────────── */
.input-field,
.editor-field {
  position: relative;
  margin-bottom: 14px;
}
.field-label {
  position: absolute;
  left: 36px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 13px;
  color: var(--text-muted);
  pointer-events: none;
  transform-origin: left center;
  transition: top 0.18s ease, transform 0.18s ease, color 0.18s ease, background 0.18s ease, padding 0.18s ease;
  z-index: 1;
}
.editor-field .field-label {
  top: 22px;
  transform: none;
}
.input-field:focus-within .field-label,
.input-field.has-content .field-label {
  top: 10px;
  transform: scale(0.82);
  color: var(--accent);
  background: var(--bg-elevated);
  padding: 0 4px;
  left: 32px;
}
.editor-field:focus-within .field-label,
.editor-field.has-content .field-label {
  top: -8px;
  transform: scale(0.82);
  color: var(--accent);
  background: var(--bg-elevated);
  padding: 0 4px;
  left: 32px;
}

/* ── 输入框 & 编辑区通用边框 ─────────────────────────── */
.input,
.editor-wrap {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--bg-surface);
  color: var(--text-primary);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.input {
  padding: 9px 12px;
  font-size: 13px;
  outline: none;
}
.input.floating { padding: 24px 12px 8px; }

.input-field:focus-within .input,
.editor-wrap:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

/* ── 分类选择 ─────────────────────────────────────────── */
.select-field {
  position: relative;
  margin-bottom: 14px;
  padding: 0 24px;
}
.select-label {
  display: block;
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 5px;
  padding-left: 2px;
  letter-spacing: 0.02em;
}
.select-input {
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
  padding-right: 32px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
}
.select-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); outline: none; }

/* ── 富文本编辑器 ─────────────────────────────────────── */
:deep(.editor-content) {
  min-height: 160px;
  padding: 28px 12px 12px;
  color: var(--text-primary);
  outline: none;
  white-space: pre-wrap;
  line-height: 1.65;
  font-size: 13px;
}
:deep(.editor-content p) { margin: 0; }
:deep(.editor-content p + p) { margin-top: 2px; }

/* ── 变量识别 ─────────────────────────────────────────── */
.vars-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 24px;
  margin-bottom: 14px;
  min-height: 24px;
}
.vars-label {
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
  letter-spacing: 0.02em;
}
.vars-empty { font-size: 12px; color: var(--text-muted); }
.var-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 11px;
  font-family: monospace;
  border: 1px solid rgba(59, 130, 246, 0.2);
}

/* ── 标签 ─────────────────────────────────────────────── */
.tags-section {
  padding: 0 24px;
  margin-bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tags-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  border-radius: 4px;
  background: var(--bg-hover);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  border: 1px solid var(--border);
  transition: border-color 0.12s, color 0.12s;
}
.tag-chip:hover { border-color: #f87171; color: #f87171; }
.tag-remove { font-size: 11px; opacity: 0.6; }
.tag-input {
  font-size: 12px;
  padding: 7px 10px;
}

/* ── 图片上传 ─────────────────────────────────────────── */
.upload {
  margin: 0 24px 14px;
  border: 1px dashed var(--border);
  border-radius: 7px;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--text-secondary);
  font-size: 13px;
  transition: border-color 0.15s, background 0.15s;
  cursor: default;
}
.upload.over { border-color: var(--accent); background: var(--accent-soft); }
.upload-icon { font-size: 16px; line-height: 1; }
.pick {
  color: var(--accent);
  cursor: pointer;
  font-weight: 500;
}
.pick:hover { text-decoration: underline; }

/* ── 图片列表 ─────────────────────────────────────────── */
.img-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 8px;
  margin: 0 24px 14px;
}
.img-item {
  position: relative;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
  height: 80px;
}
.img-item img { width: 100%; height: 100%; object-fit: cover; }
.img-remove {
  position: absolute; top: 3px; right: 3px;
  width: 18px; height: 18px;
  border: none; border-radius: 50%;
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  font-size: 13px; line-height: 1;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}

/* ── 提示 & 底部操作栏 ────────────────────────────────── */
.no-category-tip {
  margin: 0 24px 14px;
  padding: 10px 12px;
  border: 1px solid rgba(251, 191, 36, 0.3);
  border-radius: 6px;
  background: rgba(251, 191, 36, 0.06);
  color: #fbbf24;
  font-size: 12px;
  line-height: 1.6;
}
.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px 20px;
  border-top: 1px solid var(--border);
  margin-top: 4px;
  flex-shrink: 0;
  gap: 12px;
}
.error { color: #f87171; font-size: 12px; flex: 1; }
.actions { display: flex; gap: 8px; flex-shrink: 0; }
.btn {
  padding: 7px 16px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.12s;
}
.btn.primary { background: var(--accent); color: #fff; }
.btn.primary:hover { background: var(--accent-hover, #2563eb); }
.btn.ghost {
  background: var(--bg-hover);
  color: var(--text-secondary);
  border: 1px solid var(--border);
}
.btn.ghost:hover { color: var(--text-primary); }
</style>
