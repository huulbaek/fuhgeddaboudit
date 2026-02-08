<script setup lang="ts">
const { trigger } = useGrounding()
</script>

<template>
  <button
    @click="trigger('panic-button')"
    class="panic-button fixed z-50 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg flex items-center justify-center transition-colors"
    aria-label="Grounding — I need to feel safe"
    title="Grounding"
  >
    <UIcon name="i-heroicons-shield-check" class="w-6 h-6 sm:w-7 sm:h-7" />
  </button>
</template>

<style scoped>
.panic-button {
  bottom: max(1rem, env(safe-area-inset-bottom));
  right: max(1rem, env(safe-area-inset-right));
}

@media (min-width: 640px) {
  .panic-button {
    bottom: max(1.5rem, env(safe-area-inset-bottom));
    right: max(1.5rem, env(safe-area-inset-right));
  }
}
</style>
