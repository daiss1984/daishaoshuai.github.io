<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import { useData } from 'vitepress'

const { page, isDark } = useData()

const isPost = computed(() => {
  const p = page.value.relativePath
  return p.startsWith('posts/') || p.startsWith('zh/posts/')
})

const theme = computed(() => isDark.value ? 'dark' : 'light')

const loaded = ref(false)

function loadGiscus() {
  if (loaded.value) {
    // If already loaded, just update the theme
    const iframe = document.querySelector<HTMLIFrameElement>('iframe.giscus-frame')
    if (iframe) {
      iframe.contentWindow?.postMessage(
        { giscus: { setConfig: { theme: theme.value } } },
        'https://giscus.app'
      )
    }
    return
  }

  const script = document.createElement('script')
  script.src = 'https://giscus.app/client.js'
  script.setAttribute('data-repo', 'daiss1984/daiss1984.github.io')
  script.setAttribute('data-repo-id', 'R_kgDOTahw2g')
  script.setAttribute('data-category', 'General')
  script.setAttribute('data-category-id', 'DIC_kwDOTahw2s4DBZvK')
  script.setAttribute('data-mapping', 'pathname')
  script.setAttribute('data-strict', '0')
  script.setAttribute('data-reactions-enabled', '1')
  script.setAttribute('data-emit-metadata', '0')
  script.setAttribute('data-input-position', 'top')
  script.setAttribute('data-theme', theme.value)
  script.setAttribute('data-lang', 'zh-CN')
  script.setAttribute('crossorigin', 'anonymous')
  script.async = true

  const container = document.getElementById('giscus-container')
  if (container) {
    container.innerHTML = ''
    container.appendChild(script)
    loaded.value = true
  }
}

watch(isDark, () => {
  if (isPost.value && loaded.value) {
    const iframe = document.querySelector<HTMLIFrameElement>('iframe.giscus-frame')
    if (iframe) {
      iframe.contentWindow?.postMessage(
        { giscus: { setConfig: { theme: theme.value } } },
        'https://giscus.app'
      )
    }
  }
})

onMounted(() => {
  if (isPost.value) {
    loadGiscus()
  }
})

// Reload when page changes (SPA navigation)
watch(() => page.value.relativePath, () => {
  loaded.value = false
  setTimeout(() => {
    if (isPost.value) {
      loadGiscus()
    }
  }, 200)
})
</script>

<template>
  <div v-if="isPost" class="giscus-wrapper">
    <div id="giscus-container"></div>
  </div>
</template>

<style scoped>
.giscus-wrapper {
  margin-top: 48px;
  padding-top: 24px;
  border-top: 1px solid var(--vp-c-divider);
}
</style>
