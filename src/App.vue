<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

onMounted(() => {
  const utools = window?.utools

  if (!utools || typeof utools.onPluginEnter !== 'function') {
    router.replace('/')
    return
  }

  utools.onPluginEnter(({ code }) => {
    if (code === 'admin') {
      router.replace('/admin')
    } else {
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
