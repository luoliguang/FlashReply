<script setup>
import { getTagColor } from '../utils/tag-color'

const props = defineProps({
  answer: { type: Object, required: true },
  active: { type: Boolean, default: false },
  copied: { type: Boolean, default: false }
})

const emit = defineEmits(['copy', 'insert'])

function tagStyle(tag) {
  const palette = getTagColor(tag)
  return {
    '--tag-bg': palette.bg,
    '--tag-color': palette.color
  }
}
</script>

<template>
  <div class="answer-card" :class="{ active }">
    <div>
      <div class="title">{{ props.answer.title }}</div>
      <div class="tags">
        <span v-for="tag in props.answer.tags || []" :key="tag" class="tag" :style="tagStyle(tag)">{{ tag }}</span>
      </div>
      <div class="preview">{{ props.answer.content }}</div>
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
  align-items: center;
}
.answer-card:hover {
  background: var(--bg-hover);
}
.answer-card.active {
  background: var(--accent-soft);
  border-left: 2px solid var(--accent);
  padding-left: 12px;
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
}
.actions {
  display: inline-flex;
  gap: 6px;
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
  0% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
}
</style>
