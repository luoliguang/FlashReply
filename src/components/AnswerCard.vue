<script setup>
import { ref } from 'vue'
import { ChevronDown, ChevronUp } from 'lucide-vue-next'
import { getTagColor } from '../utils/tag-color'

const props = defineProps({
  answer: { type: Object, required: true },
  active: { type: Boolean, default: false },
  copied: { type: Boolean, default: false }
})

const emit = defineEmits(['copy', 'insert', 'drag-to-category'])

const expanded = ref(false)

function onDragStart(e) {
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('application/x-quick-reply-drag-type', 'answer')
  e.dataTransfer.setData('application/x-quick-reply-answer-id', props.answer._id)
}

function tagStyle(tag) {
  const palette = getTagColor(tag)
  return {
    '--tag-bg': palette.bg,
    '--tag-color': palette.color
  }
}
</script>

<template>
  <div class="answer-card" :class="{ active, expanded }" draggable="true" @dragstart="onDragStart">
    <div class="card-main">
      <div class="title">{{ props.answer.title }}</div>
      <div class="tags">
        <span v-for="tag in props.answer.tags || []" :key="tag" class="tag" :style="tagStyle(tag)">{{ tag }}</span>
      </div>
      <div class="preview" :class="{ expanded }" @click="expanded = !expanded">{{ props.answer.content }}</div>
      <button v-if="props.answer.content?.length > 80" class="expand-toggle" @click="expanded = !expanded">
        <component :is="expanded ? ChevronUp : ChevronDown" :size="12" />
        {{ expanded ? '收起' : '展开' }}
      </button>
    </div>
    <div class="actions">
      <button class="btn-insert" @click="emit('insert', props.answer)">插入</button>
      <button class="btn-copy" :class="{ copied: props.copied }" @click="emit('copy', props.answer)">
        {{ props.copied ? '已复制' : '复制' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.answer-card {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  transition: background 0.1s ease;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: start;
}
.answer-card:hover {
  background: var(--bg-hover);
}
.answer-card.active {
  background: var(--accent-soft);
  border-left: 2px solid var(--accent);
  padding-left: 12px;
}
.card-main {
  min-width: 0;
}
.title {
  font-size: 14px;
  font-weight: 600;
}
.tags {
  margin: 3px 0;
}
.tag {
  display: inline-block;
  padding: 1px 7px;
  border-radius: 3px;
  font-size: 11px;
  background: var(--tag-bg);
  color: var(--tag-color);
  margin-right: 6px;
}
.preview {
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 12px;
  margin-top: 2px;
  cursor: pointer;
  white-space: pre-wrap;
  word-break: break-all;
}
.preview.expanded {
  display: block;
  overflow: visible;
  -webkit-line-clamp: unset;
}
.expand-toggle {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-top: 4px;
  padding: 0;
  border: none;
  background: none;
  color: var(--text-muted);
  font-size: 11px;
  cursor: pointer;
  transition: color 0.1s;
}
.expand-toggle:hover {
  color: var(--accent);
}
.actions {
  display: inline-flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 2px;
}
.btn-insert,
.btn-copy {
  padding: 4px 10px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}
.btn-insert {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
}
.btn-insert:hover {
  background: rgba(16, 185, 129, 0.3);
}
.btn-copy {
  background: var(--accent);
  color: #fff;
}
.btn-copy:hover {
  background: var(--accent-hover);
}
.btn-copy.copied {
  background: var(--success);
  animation: flash-success 0.4s ease;
}
@keyframes flash-success {
  0% { transform: scale(1.05); }
  100% { transform: scale(1); }
}
</style>
