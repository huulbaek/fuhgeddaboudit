<script setup lang="ts">
const { trigger } = useGrounding()
</script>

<template>
  <button
    @click="trigger('panic-button')"
    class="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg flex items-center justify-center transition-colors"
    aria-label="Grounding — I need to feel safe"
    title="Grounding"
  >
    <UIcon name="i-heroicons-shield-check" class="w-7 h-7" />
  </button>
</template>
