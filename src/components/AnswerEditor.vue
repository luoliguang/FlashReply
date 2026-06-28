<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue'
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

function removeImage(id) {
  form.value.images = form.value.images.filter((img) => img.id !== id)
}

function onSave() {
  const title = String(form.value.title || '').trim()
  const content = String(form.value.content || '').trim()

  if (!title) {
    error.value = '标题不能为空'
    return
  }
  if (title.length > TITLE_MAX_LENGTH) {
    error.value = `标题不能超过 ${TITLE_MAX_LENGTH} 个字符`
    return
  }
  if (!content) {
    error.value = '内容不能为空'
    return
  }

  error.value = ''

  emit('save', {
    ...form.value,
    title,
    content,
    variables: parsedVars.value
  })
}
</script>

<template>
  <div v-if="show" class="mask" @click.self="emit('cancel')">
    <div class="modal" tabindex="0" @keydown.esc.prevent="emit('cancel')">
      <h3>新建模板</h3>

      <div class="input-field" :class="{ 'has-content': !!form.title?.trim() }">
        <span class="field-label">标题</span>
        <input v-model="form.title" class="input floating" />
      </div>

      <select v-model="form.categoryId" class="input">
        <option v-for="cat in props.categories" :key="cat._id" :value="cat._id">
          {{ cat.level === 2 ? '└ ' : '' }}{{ cat.icon }} {{ cat.name }}
        </option>
      </select>

      <div class="editor-field" :class="{ 'has-content': !!form.content?.trim() }">
        <span class="field-label">内容</span>
        <div class="editor-wrap">
          <EditorContent :editor="editor" />
        </div>
      </div>

      <div class="vars">
        已识别变量：
        <span v-for="v in parsedVars" :key="v" class="tag">{{ v }}</span>
      </div>

      <div class="input-field tag-field" :class="{ 'has-content': !!form.tags?.length }">
        <span class="field-label">标签（回车添加）</span>
        <input class="input floating tag-floating-input" @keydown="addTag" />
      </div>
      <div class="tags-chips">
        <span v-for="tag in form.tags" :key="tag" class="tag tag-item" @click="removeTag(tag)">{{ tag }} ×</span>
      </div>

      <div class="upload" :class="{ over: dragOver }" @drop="onDrop" @dragover="onDragOver" @dragleave="onDragLeave">
        <div>拖拽图片到这里，或</div>
        <label class="pick">
          选择图片
          <input type="file" accept="image/*" multiple hidden @change="onImageSelect" />
        </label>
      </div>

      <div class="img-list">
        <div v-for="img in form.images" :key="img.id" class="img-item">
          <img :src="img.dataUrl" :alt="img.name" />
          <button class="x" @click="removeImage(img.id)">×</button>
        </div>
      </div>

      <div v-if="error" class="error">{{ error }}</div>

      <div class="actions">
        <button class="btn" @click="onSave">保存</button>
        <button class="btn ghost" @click="emit('cancel')">取消</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mask { position: fixed; inset: 0; background: rgba(0,0,0,.35); display: grid; place-items: center; }
.modal { width: min(760px, 92vw); max-height: 88vh; overflow: auto; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 8px; padding: 12px; }

.input-field,
.editor-field {
  position: relative;
  margin-bottom: 8px;
}

.field-label {
  position: absolute;
  left: 12px;
  top: 18px;
  font-size: 14px;
  line-height: 1;
  color: var(--text-muted);
  pointer-events: none;
  transform-origin: left top;
  transition: top 0.2s ease, transform 0.2s ease, color 0.2s ease, background-color 0.2s ease, padding 0.2s ease;
  z-index: 1;
}

.input,
.editor-wrap {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-surface);
  color: var(--text-primary);
}

.input {
  margin-bottom: 8px;
  padding: 8px;
}

.input.floating {
  margin-bottom: 0;
  padding: 26px 12px 10px;
}

.input-field:focus-within .field-label,
.input-field.has-content .field-label,
.editor-field:focus-within .field-label,
.editor-field.has-content .field-label {
  top: -8px;
  transform: scale(0.86);
  color: #8fc3ff;
  background: var(--bg-elevated);
  padding: 0 6px;
}

.input-field:focus-within .input,
.editor-wrap:focus-within {
  border-color: #7bb6ff;
  box-shadow: 0 0 0 1px rgba(123, 182, 255, 0.2);
}

:deep(.editor-content) {
  min-height: 140px;
  padding: 26px 12px 12px;
  color: var(--text-primary);
  outline: none;
  white-space: pre-wrap;
  line-height: 1.6;
}
:deep(.editor-content p) { margin: 0; }
:deep(.editor-content p + p) { margin-top: 0; }

.vars { color: var(--text-secondary); margin-bottom: 8px; }
.tag { display: inline-block; padding: 2px 8px; border-radius: 4px; background: var(--accent-soft); color: var(--accent); margin-right: 6px; font-size: 12px; }
.tags { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
.tag-item { cursor: pointer; }
.tag-input { flex: 1; min-width: 140px; padding: 6px; background: var(--bg-surface); border: 1px solid var(--border); color: var(--text-primary); }
.upload { border: 1px dashed var(--border); border-radius: 8px; padding: 14px; text-align: center; color: var(--text-secondary); margin-bottom: 8px; }
.upload.over { border-color: var(--accent); background: var(--accent-soft); }
.pick { display: inline-block; margin-top: 6px; color: var(--accent); cursor: pointer; }
.img-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)); gap: 8px; margin-bottom: 8px; }
.img-item { position: relative; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; height: 88px; }
.img-item img { width: 100%; height: 100%; object-fit: cover; }
.x { position: absolute; top: 2px; right: 2px; width: 20px; height: 20px; border: 0; border-radius: 50%; cursor: pointer; background: rgba(0,0,0,.6); color: white; }
.error { color: #f87171; margin-bottom: 8px; }
.actions { display: flex; gap: 8px; }
.btn { padding: 6px 10px; border: 0; border-radius: 4px; background: var(--accent); color: white; cursor: pointer; }
.btn.ghost { background: var(--bg-hover); color: var(--text-primary); }
</style>
