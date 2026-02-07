<script setup lang="ts">
definePageMeta({ layout: 'default' })

function onSafePlaceComplete(_description: string) {
  navigateTo('/preparation/readiness')
}
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <h1 class="text-2xl font-bold mb-2">Preparation</h1>

    <div class="mb-6 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
      <span class="text-primary font-semibold">Step 1: Safe Place</span>
      <span>→</span>
      <span class="text-gray-400 dark:text-gray-600">Step 2: Readiness Check</span>
    </div>

    <PreparationSafePlaceBuilder @complete="onSafePlaceComplete" />
  </div>
</template>
