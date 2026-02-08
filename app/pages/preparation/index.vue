<script setup lang="ts">
definePageMeta({ layout: 'default' })

function onSafePlaceComplete(_description: string) {
  navigateTo('/preparation/readiness')
}
</script>

<template>
  <div class="max-w-2xl mx-auto py-2 sm:py-4">
    <h1 class="text-2xl font-bold mb-2">Preparation</h1>

    <div class="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
      <span class="text-primary font-semibold">Step 1: Safe Place</span>
      <span class="hidden sm:inline">→</span>
      <span class="text-gray-400 dark:text-gray-600">Step 2: Readiness Check</span>
    </div>

    <PreparationSafePlaceBuilder @complete="onSafePlaceComplete" />
  </div>
</template>
