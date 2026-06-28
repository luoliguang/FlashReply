<script setup>
import { reactive, watch } from 'vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  variables: { type: Array, default: () => [] }
})

const emit = defineEmits(['confirm', 'cancel'])

const form = reactive({})

watch(
  () => props.variables,
  (vars) => {
    Object.keys(form).forEach((k) => delete form[k])
    vars.forEach((v) => {
      form[v] = ''
    })
  },
  { immediate: true }
)

function onConfirm() {
  emit('confirm', { ...form })
}
</script>

<template>
  <div v-if="show" class="mask" @click.self="emit('cancel')">
    <div class="modal" tabindex="0" @keydown.esc.prevent="emit('cancel')">
      <h3>填写变量</h3>
      <label v-for="name in variables" :key="name" class="field">
        <span>{{ name }}</span>
        <input v-model="form[name]" />
      </label>
      <div class="actions">
        <button class="btn" @click="onConfirm">确认复制</button>
        <button class="btn ghost" @click="emit('cancel')">取消</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mask { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.35); display: grid; place-items: center; }
.modal { width: 420px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 8px; padding: 12px; }
.field { display: grid; gap: 6px; margin-bottom: 8px; }
.field input { padding: 8px; background: var(--bg-surface); border: 1px solid var(--border); color: var(--text-primary); }
.actions { display: flex; gap: 8px; }
.btn { padding: 6px 10px; border: 0; border-radius: 4px; background: var(--accent); color: white; cursor: pointer; }
.btn.ghost { background: var(--bg-hover); color: var(--text-primary); }
</style>
