<script setup lang="ts">
const url = useRequestURL()
const ogImage = `${url.origin}/og-image.png`

useHead({
  meta: [
    { property: 'og:image', content: ogImage },
    { name: 'twitter:image', content: ogImage },
  ],
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
