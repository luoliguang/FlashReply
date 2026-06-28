<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'

const emit = defineEmits(['done'])

let driverObj = null
let completed = false

const steps = [
  {
    popover: {
      title: '👋 欢迎使用 FlashReply',
      description:
        '客服快速回复助手——帮你在几秒内找到并发送回复模板，让每一次对话都更高效。<br><br>接下来我们来认识一下主要功能，点击「下一步」开始。',
      side: 'over',
      align: 'center',
    },
  },
  {
    element: '#tour-search',
    popover: {
      title: '即时搜索',
      description:
        '直接输入关键词，支持标题、内容、标签、分类的模糊匹配，结果即时呈现。<br><br><span class="tour-hint">按 ↑ / ↓ 方向键可以在结果间移动，回车直接触发插入。</span>',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '#tour-strategy',
    popover: {
      title: '两种发送方式',
      description:
        '<strong>置顶复制</strong>：内容复制到剪贴板，手动粘贴。<br><strong>自动插入</strong>：直接写入当前输入框，无需切换窗口。<br><br><span class="tour-hint">选择后设置自动保存，下次唤出直接生效。</span>',
      side: 'bottom',
    },
  },
  {
    element: '#tour-categories',
    popover: {
      title: '分类筛选',
      description:
        '按分类快速缩小范围，支持二级分类，可拖拽调整顺序。<br><br><span class="tour-hint">点击「全部」回到不过滤的状态。</span>',
      side: 'right',
    },
  },
  {
    element: '#tour-admin',
    popover: {
      title: '管理回复模板',
      description:
        '进入管理界面，新建、编辑回复模板，配置分类、标签，支持附加图片。<br><br><span class="tour-hint">支持数据导出/导入，方便团队共享回复库。</span>',
      side: 'bottom',
      align: 'end',
    },
  },
  {
    element: '#tour-help',
    popover: {
      title: '随时查看教程',
      description: '点击这里可以随时重新打开本教程。',
      side: 'bottom',
      align: 'end',
      nextBtnText: '开始使用 →',
    },
  },
]

onMounted(() => {
  driverObj = driver({
    animate: true,
    showProgress: true,
    progressText: '{{current}}/{{total}}',
    allowClose: true,
    overlayOpacity: 0.82,
    stagePadding: 8,
    stageRadius: 8,
    disableActiveInteraction: true,
    steps,
    onNextClick: () => {
      if (!driverObj.hasNextStep()) completed = true
      driverObj.moveNext()
    },
    onHighlighted: (el) => {
      if (!el) return
      el.style.transition = 'box-shadow 0.25s ease'
      el.style.boxShadow = '0 0 0 2px #3b82f6, 0 0 0 5px rgba(59,130,246,0.35), 0 0 28px rgba(59,130,246,0.5)'
      el.style.borderRadius = '7px'
    },
    onDeselected: (el) => {
      if (!el) return
      el.style.boxShadow = ''
      el.style.borderRadius = ''
      el.style.transition = ''
    },
    onDestroyStarted: () => {
      driverObj.destroy()
    },
    onDestroyed: () => {
      emit('done', completed ? 'finish' : 'skip')
    },
  })

  // slight delay so Main page fully renders before driver queries DOM
  setTimeout(() => driverObj.drive(), 80)
})

onBeforeUnmount(() => {
  if (driverObj?.isActive()) driverObj.destroy()
})
</script>

<!-- No template — driver.js renders its own DOM in document.body -->
<template></template>

<style>
/* ── Driver.js dark theme ─────────────────────────────────────
   These must be UNSCOPED so they apply to driver's body-level DOM
   ─────────────────────────────────────────────────────────── */

/* Popover container */
.driver-popover {
  background: #1e1e1e !important;
  border: 1px solid rgba(255, 255, 255, 0.09) !important;
  border-radius: 10px !important;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.7) !important;
  padding: 16px 18px 14px !important;
  min-width: 280px !important;
  max-width: 320px !important;
  color: #f0f0f0 !important;
  font-family: 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif !important;
}

/* Top gradient accent line */
.driver-popover::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, #3b82f6, transparent);
  opacity: 0.6;
  border-radius: 10px 10px 0 0;
}

.driver-popover-title {
  color: #f0f0f0 !important;
  font-size: 14px !important;
  font-weight: 600 !important;
  margin-bottom: 8px !important;
  line-height: 1.4 !important;
}

.driver-popover-description {
  color: #9ca3af !important;
  font-size: 12px !important;
  line-height: 1.75 !important;
  margin-bottom: 0 !important;
}

/* Custom hint span inside description */
.driver-popover-description .tour-hint {
  display: inline-block;
  margin-top: 6px;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 5px;
  font-size: 11px;
  color: #6b7280;
  line-height: 1.6;
}

/* Footer: progress + buttons */
.driver-popover-footer {
  margin-top: 14px !important;
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
}

.driver-popover-progress-text {
  color: #6b7280 !important;
  font-size: 11px !important;
  margin-right: auto !important;
}

/* Close button (×) */
.driver-popover-close-btn {
  color: #4b5563 !important;
  font-size: 18px !important;
  line-height: 1 !important;
  opacity: 1 !important;
  transition: color 0.12s !important;
}
.driver-popover-close-btn:hover {
  color: #9ca3af !important;
}

/* Prev button */
.driver-popover-prev-btn {
  background: #2a2a2a !important;
  border: 1px solid #2e2e2e !important;
  color: #d1d5db !important;
  border-radius: 6px !important;
  padding: 5px 12px !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  cursor: pointer !important;
  text-shadow: none !important;
  transition: background 0.12s, border-color 0.12s !important;
}
.driver-popover-prev-btn:hover {
  background: #323232 !important;
  border-color: rgba(255, 255, 255, 0.12) !important;
}
.driver-popover-prev-btn:disabled {
  opacity: 0.3 !important;
  cursor: not-allowed !important;
}

/* Next / Done button */
.driver-popover-next-btn {
  background: #3b82f6 !important;
  border: 1px solid #3b82f6 !important;
  color: #fff !important;
  border-radius: 6px !important;
  padding: 5px 14px !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  cursor: pointer !important;
  text-shadow: none !important;
  transition: background 0.12s, opacity 0.12s !important;
}
.driver-popover-next-btn:hover {
  background: #2563eb !important;
  border-color: #2563eb !important;
}

/* Popover arrow matches background */
.driver-popover-arrow-side-left.driver-popover-arrow { border-left-color: #1e1e1e !important; }
.driver-popover-arrow-side-right.driver-popover-arrow { border-right-color: #1e1e1e !important; }
.driver-popover-arrow-side-top.driver-popover-arrow { border-top-color: #1e1e1e !important; }
.driver-popover-arrow-side-bottom.driver-popover-arrow { border-bottom-color: #1e1e1e !important; }
</style>
