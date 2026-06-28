<script setup>
import { onMounted, ref } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue', 'escape', 'up', 'down', 'enter'])

const inputRef = ref(null)

function onInput(e) {
  emit('update:modelValue', e.target.value)
}

function focus() {
  inputRef.value?.focus()
}

defineExpose({ focus })

onMounted(() => {
  inputRef.value?.focus()
})
</script>

<template>
  <input
    ref="inputRef"
    class="search-bar"
    :value="props.modelValue"
    placeholder="搜索标题、标签、内容..."
    @input="onInput"
    @keydown.esc.prevent="emit('escape')"
    @keydown.up.prevent="emit('up')"
    @keydown.down.prevent="emit('down')"
    @keydown.enter.prevent="emit('enter')"
  />
</template>

<style scoped>
.search-bar {
  width: 100%;
  height: 44px;
  padding: 0 16px 0 16px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 14px;
  transition: border-color 0.15s ease;
  box-sizing: border-box;
}
.search-bar:focus {
  border-color: var(--accent);
  outline: none;
  box-shadow: 0 0 0 3px var(--accent-soft);
}
</style>
