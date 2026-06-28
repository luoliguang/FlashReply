<script setup>
import { ref, computed, watch } from 'vue'
import { Check, Copy, X, FileText, Image, ZoomIn } from 'lucide-vue-next'
import { copyImage } from '../utils/clipboard'
import { useAnswersStore } from '../stores/answers'

const props = defineProps({
  show:       { type: Boolean, default: false },
  filledText: { type: String,  default: '' },
  answer:     { type: Object,  default: null }
})

const emit = defineEmits(['close'])

const store = useAnswersStore()
const textCopied   = ref(false)
const copiedSet    = ref(new Set())
const copyingIdx   = ref(-1)
const useCounted   = ref(false)
const lightboxImg  = ref(null)   // { dataUrl, name } — null = closed

watch(() => props.show, (val) => {
  if (val) {
    textCopied.value  = false
    copiedSet.value   = new Set()
    copyingIdx.value  = -1
    useCounted.value  = false
    lightboxImg.value = null
  }
})

const images     = computed(() => props.answer?.images || [])
const totalSteps = computed(() => 1 + images.value.length)
const doneCount  = computed(() => (textCopied.value ? 1 : 0) + copiedSet.value.size)
const allDone    = computed(() => doneCount.value === totalSteps.value)

async function doCopyText() {
  if (textCopied.value) return
  try {
    if (window.utools?.copyText) {
      window.utools.copyText(props.filledText)
    } else {
      await navigator.clipboard.writeText(props.filledText)
    }
    textCopied.value = true
    if (!useCounted.value && props.answer) {
      store.incrementUseCount(props.answer._id)
      useCounted.value = true
    }
  } catch {
    /* ignore */
  }
}

async function doCopyImage(idx) {
  if (copyingIdx.value !== -1 || copiedSet.value.has(idx)) return
  copyingIdx.value = idx
  try {
    await copyImage(images.value[idx].dataUrl)
    const next = new Set(copiedSet.value)
    next.add(idx)
    copiedSet.value = next
  } finally {
    copyingIdx.value = -1
  }
}

function openLightbox(img) {
  lightboxImg.value = img
}

function closeLightbox() {
  lightboxImg.value = null
}

function close() {
  lightboxImg.value = null
  emit('close')
}
</script>

<template>
  <transition name="assistant-fade">
    <div v-if="show" class="mask" @click.self="close">
      <div class="panel" :class="{ 'all-done': allDone }">

        <!-- Header -->
        <div class="head">
          <div class="head-title">
            <span class="head-label">复制助手</span>
            <span v-if="answer?.title" class="head-answer-title">{{ answer.title }}</span>
          </div>
          <button class="close-btn" @click="close"><X :size="14" /></button>
        </div>

        <!-- Progress bar -->
        <div class="progress-wrap">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${totalSteps ? (doneCount / totalSteps) * 100 : 0}%` }" />
          </div>
          <span class="progress-label">
            <template v-if="allDone">全部完成</template>
            <template v-else>{{ doneCount }} / {{ totalSteps }} 已复制</template>
          </span>
        </div>

        <!-- Step 1: Text -->
        <div class="step" :class="{ done: textCopied }">
          <div class="step-icon"><FileText :size="13" /></div>
          <div class="step-body">
            <div class="step-name">文字内容</div>
            <div class="step-preview">{{ filledText }}</div>
          </div>
          <button
            class="copy-btn"
            :class="{ copied: textCopied }"
            @click="doCopyText"
          >
            <Check v-if="textCopied" :size="12" />
            <Copy v-else :size="12" />
            {{ textCopied ? '已复制' : '复制文字' }}
          </button>
        </div>

        <!-- Step 2+: Images -->
        <div
          v-for="(img, idx) in images"
          :key="img.id || idx"
          class="step"
          :class="{ done: copiedSet.has(idx) }"
        >
          <div class="step-icon img-icon">
            <Image :size="13" />
          </div>
          <div class="step-body img-body">
            <div class="step-name">图片 {{ idx + 1 }}/{{ images.length }}</div>
            <div class="img-thumb-wrap" @click="openLightbox(img)">
              <img class="img-thumb" :src="img.dataUrl" :alt="img.name || `图片${idx+1}`" />
              <div class="img-zoom-overlay">
                <ZoomIn :size="16" />
              </div>
            </div>
          </div>
          <button
            class="copy-btn"
            :class="{ copied: copiedSet.has(idx), loading: copyingIdx === idx }"
            :disabled="copyingIdx !== -1 && copyingIdx !== idx"
            @click="doCopyImage(idx)"
          >
            <Check v-if="copiedSet.has(idx)" :size="12" />
            <Copy v-else :size="12" />
            {{ copiedSet.has(idx) ? '已复制' : copyingIdx === idx ? '复制中…' : '复制图片' }}
          </button>
        </div>

        <!-- Done footer -->
        <div class="footer">
          <transition name="done-in">
            <div v-if="allDone" class="done-badge">
              <Check :size="12" /> 全部完成，可粘贴到目标位置
            </div>
          </transition>
          <button class="btn-close-main" @click="close">关闭</button>
        </div>

      </div>

    </div>
  </transition>

  <!-- Lightbox — sibling transition at template root (Vue 3 fragment) -->
  <transition name="lightbox-fade">
    <div v-if="lightboxImg" class="lightbox" @click="closeLightbox">
      <button class="lightbox-close" @click.stop="closeLightbox"><X :size="16" /></button>
      <img
        class="lightbox-img"
        :src="lightboxImg.dataUrl"
        :alt="lightboxImg.name || '图片预览'"
        @click.stop
      />
      <div v-if="lightboxImg.name" class="lightbox-name">{{ lightboxImg.name }}</div>
    </div>
  </transition>
</template>

<style scoped>
/* ── Keyframes ───────────────────────────────────────────────── */
@keyframes panel-in {
  from { opacity: 0; transform: scale(0.96) translateY(-8px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes fill-grow {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}
@keyframes step-done {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.015); }
  100% { transform: scale(1); }
}

/* ── Overlay ─────────────────────────────────────────────────── */
.mask {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(3px);
  display: grid; place-items: center;
  z-index: 50;
}
.assistant-fade-enter-active { animation: panel-in 0.2s cubic-bezier(0.2, 0, 0, 1) both; }
.assistant-fade-leave-active { transition: opacity 0.15s ease; }
.assistant-fade-leave-to { opacity: 0; }

/* ── Panel ───────────────────────────────────────────────────── */
.panel {
  width: min(520px, 94vw);
  background: var(--bg-elevated);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 0;
  box-shadow: 0 32px 64px rgba(0, 0, 0, 0.6);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 0;
  transition: border-color 0.3s ease;
}
.panel.all-done {
  border-color: rgba(34, 197, 94, 0.3);
}

/* ── Header ──────────────────────────────────────────────────── */
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 10px;
  border-bottom: 1px solid var(--border);
}
.head-title { display: flex; align-items: baseline; gap: 8px; overflow: hidden; }
.head-label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-secondary);
  flex-shrink: 0;
}
.head-answer-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.close-btn {
  border: none; background: none;
  color: var(--text-muted); cursor: pointer;
  display: flex; align-items: center;
  padding: 4px; border-radius: 4px;
  transition: color 0.12s, background 0.12s;
  flex-shrink: 0;
}
.close-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

/* ── Progress ────────────────────────────────────────────────── */
.progress-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--border);
}
.progress-bar {
  flex: 1;
  height: 3px;
  background: var(--bg-hover);
  border-radius: 99px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 99px;
  transition: width 0.35s cubic-bezier(0.2, 0, 0, 1);
}
.panel.all-done .progress-fill { background: var(--success); }
.progress-label {
  font-size: 11px;
  color: var(--text-secondary);
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  transition: color 0.3s;
}
.panel.all-done .progress-label { color: var(--success); }

/* ── Steps ───────────────────────────────────────────────────── */
.step {
  display: grid;
  grid-template-columns: 28px 1fr auto;
  gap: 10px;
  align-items: start;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
  transition: background 0.2s ease;
}
.step:last-of-type { border-bottom: none; }
.step.done { background: rgba(34, 197, 94, 0.04); animation: step-done 0.3s ease; }

.step-icon {
  display: flex; align-items: center; justify-content: center;
  width: 26px; height: 26px;
  border-radius: 6px;
  background: var(--bg-hover);
  color: var(--text-secondary);
  flex-shrink: 0;
  transition: background 0.2s, color 0.2s;
}
.step.done .step-icon { background: rgba(34, 197, 94, 0.15); color: var(--success); }

.step-body { min-width: 0; }
.step-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 4px;
  letter-spacing: 0.02em;
}
.step.done .step-name { color: var(--success); }
.step-preview {
  font-size: 12px;
  color: var(--text-primary);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 72px;
  overflow-y: auto;
  opacity: 0.8;
}
.step-preview::-webkit-scrollbar { width: 3px; }
.step-preview::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

/* Image step */
.img-icon { margin-top: 0; }
.img-body { display: flex; flex-direction: column; gap: 6px; }
.img-thumb-wrap {
  width: 80px; height: 60px;
  border-radius: 6px;
  border: 1px solid var(--border);
  overflow: hidden;
  background: #000;
  position: relative;
  cursor: zoom-in;
  flex-shrink: 0;
}
.img-thumb { width: 100%; height: 100%; object-fit: cover; display: block; transition: filter 0.15s ease; }
.img-thumb-wrap:hover .img-thumb { filter: brightness(0.65); }
.img-zoom-overlay {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  color: #fff;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.img-thumb-wrap:hover .img-zoom-overlay { opacity: 1; }

/* ── Copy button ─────────────────────────────────────────────── */
.copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg-hover);
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.1s ease;
  flex-shrink: 0;
  align-self: center;
}
.copy-btn:hover:not(:disabled):not(.copied) {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.copy-btn:active:not(:disabled) { transform: scale(0.96); }
.copy-btn.copied {
  background: rgba(34, 197, 94, 0.12);
  border-color: rgba(34, 197, 94, 0.3);
  color: var(--success);
  cursor: default;
}
.copy-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.copy-btn.loading { opacity: 0.7; cursor: wait; }

/* ── Footer ──────────────────────────────────────────────────── */
.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-top: 1px solid var(--border);
  background: var(--bg-surface);
  gap: 10px;
}
.done-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--success);
}
.done-in-enter-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.done-in-enter-from   { opacity: 0; transform: translateX(-6px); }

.btn-close-main {
  margin-left: auto;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-primary);
  border-radius: 6px;
  padding: 5px 14px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease;
}
.btn-close-main:hover {
  background: var(--bg-hover);
  border-color: rgba(255,255,255,0.12);
}

/* ── Lightbox ────────────────────────────────────────────────── */
@keyframes lightbox-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes img-in {
  from { transform: scale(0.92); opacity: 0; }
  to   { transform: scale(1);    opacity: 1; }
}

.lightbox {
  position: fixed; inset: 0; z-index: 60;
  background: rgba(0, 0, 0, 0.88);
  backdrop-filter: blur(6px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  cursor: zoom-out;
  animation: lightbox-in 0.18s ease both;
}
.lightbox-img {
  max-width: min(92vw, 960px);
  max-height: 80vh;
  object-fit: contain;
  border-radius: 6px;
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.8);
  cursor: default;
  animation: img-in 0.2s cubic-bezier(0.2, 0, 0, 1) both;
}
.lightbox-name {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  max-width: min(92vw, 960px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lightbox-close {
  position: absolute; top: 14px; right: 14px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #fff;
  border-radius: 6px;
  width: 30px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: background 0.12s ease;
}
.lightbox-close:hover { background: rgba(255, 255, 255, 0.2); }

.lightbox-fade-enter-active { transition: opacity 0.15s ease; }
.lightbox-fade-leave-active  { transition: opacity 0.12s ease; }
.lightbox-fade-enter-from,
.lightbox-fade-leave-to { opacity: 0; }
</style>
