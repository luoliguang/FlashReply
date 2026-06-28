<script setup>
import { computed, ref, watch } from 'vue'
import { copyImage } from '../utils/clipboard'

const props = defineProps({
  show: { type: Boolean, default: false },
  images: { type: Array, default: () => [] }
})

const emit = defineEmits(['close'])

const index = ref(0)
const copying = ref(false)

watch(
  () => props.show,
  (val) => {
    if (val) index.value = 0
  }
)

const current = computed(() => props.images[index.value] || null)

const canPrev = computed(() => index.value > 0)
const canNext = computed(() => index.value < props.images.length - 1)

function prev() {
  if (!canPrev.value) return
  index.value -= 1
}

function next() {
  if (!canNext.value) return
  index.value += 1
}

function selectAt(i) {
  if (i < 0 || i >= props.images.length) return
  index.value = i
}

async function copyCurrent() {
  if (!current.value || copying.value) return
  copying.value = true
  try {
    await copyImage(current.value.dataUrl)
    if (canNext.value) {
      index.value += 1
    }
  } finally {
    copying.value = false
  }
}
</script>

<template>
  <div v-if="show" class="mask" @click.self="emit('close')">
    <div class="viewer" tabindex="0" @keydown.esc.prevent="emit('close')" @keydown.left.prevent="prev" @keydown.right.prevent="next">
      <div class="head">
        <strong>图片复制（{{ index + 1 }}/{{ images.length }}）</strong>
        <button class="btn ghost" @click="emit('close')">关闭</button>
      </div>

      <div class="body-wrap">
        <button class="nav-btn" :disabled="!canPrev" @click="prev">‹</button>
        <div v-if="current" class="body">
          <img :src="current.dataUrl" :alt="current.name || 'image'" />
        </div>
        <button class="nav-btn" :disabled="!canNext" @click="next">›</button>
      </div>

      <div v-if="images.length > 1" class="thumbs">
        <button
          v-for="(img, i) in images"
          :key="img.id || i"
          class="thumb"
          :class="{ active: i === index }"
          @click="selectAt(i)"
        >
          <img :src="img.dataUrl" :alt="img.name || `thumb-${i}`" />
        </button>
      </div>

      <div class="actions">
        <button class="btn" :disabled="!current || copying" @click="copyCurrent">
          {{ copying ? '复制中...' : '复制当前图片' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mask { position: fixed; inset: 0; background: rgba(0,0,0,.35); display: grid; place-items: center; }
.viewer { width: min(620px, 94vw); background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 10px; padding: 12px; }
.head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.body-wrap { display: grid; grid-template-columns: 34px 1fr 34px; gap: 8px; align-items: center; }
.body { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: #000; min-height: 280px; display: grid; place-items: center; }
.body img { max-width: 100%; max-height: 52vh; object-fit: contain; }
.nav-btn { border: 0; border-radius: 6px; height: 38px; cursor: pointer; background: var(--bg-hover); color: var(--text-primary); font-size: 18px; }
.nav-btn:disabled { opacity: .35; cursor: not-allowed; }
.thumbs { margin-top: 8px; display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; }
.thumb { border: 1px solid var(--border); background: var(--bg-surface); border-radius: 6px; padding: 0; width: 54px; height: 54px; overflow: hidden; cursor: pointer; flex: 0 0 auto; }
.thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.thumb.active { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent-soft); }
.actions { margin-top: 8px; display: flex; gap: 8px; }
.btn { border: 0; border-radius: 4px; padding: 6px 10px; cursor: pointer; background: var(--accent); color: #fff; }
.btn.ghost { background: var(--bg-hover); color: var(--text-primary); }
</style>
