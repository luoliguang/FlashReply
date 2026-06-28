<script setup>
import AnswerCard from './AnswerCard.vue'

const props = defineProps({
  list: { type: Array, default: () => [] },
  activeIndex: { type: Number, default: 0 },
  keyword: { type: String, default: '' },
  copiedId: { type: String, default: '' }
})

const emit = defineEmits(['copy', 'insert', 'edit'])
</script>

<template>
  <section class="list">
    <AnswerCard
      v-for="(item, idx) in props.list"
      :key="item._id"
      :answer="item"
      :active="idx === props.activeIndex"
      :copied="props.copiedId === item._id"
      @copy="emit('copy', $event)"
      @insert="emit('insert', $event)"
      @edit="emit('edit', $event)"
    />

    <div v-if="props.list.length === 0" class="empty-state">
      <span class="empty-icon">🔍</span>
      <p>没有找到「{{ props.keyword }}」相关的回复</p>
      <slot name="empty-action" />
    </div>
  </section>
</template>

<style scoped>
.list {
  border: 1px solid var(--border);
  background: var(--bg-surface);
  border-radius: 6px;
  overflow: auto;
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 24px;
  color: var(--text-muted);
  gap: 8px;
}
.empty-icon {
  font-size: 32px;
}
</style>
