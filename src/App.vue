<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAnswersStore } from './stores/answers'

const router = useRouter()
const answersStore = useAnswersStore()

onMounted(() => {
  const utools = window?.utools

  if (!utools || typeof utools.onPluginEnter !== 'function') {
    router.replace('/')
    return
  }

  utools.onPluginEnter(({ code, type, payload }) => {
    if (code === 'admin') {
      router.replace('/admin')
    } else {
      const text = type === 'over' && typeof payload === 'string' ? payload.trim() : ''
      answersStore.setQuery(text)
      answersStore.notifyEnter()
      router.replace('/')
    }
  })

  if (typeof utools.onPluginOut === 'function') {
    utools.onPluginOut(() => {
      router.replace('/')
    })
  }
})
</script>

<template>
  <router-view />
</template>
