<script setup lang="ts">
const url = useRequestURL()
const ogImage = `${url.origin}/og-image.png`

useHead({
  meta: [
    { property: 'og:image', content: ogImage },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { property: 'og:image:alt', content: 'Mnemosyne Protocol — Neurocognitive Memory Protocol' },
    { name: 'twitter:image', content: ogImage },
    { name: 'twitter:image:alt', content: 'Mnemosyne Protocol — Neurocognitive Memory Protocol' },
  ],
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
