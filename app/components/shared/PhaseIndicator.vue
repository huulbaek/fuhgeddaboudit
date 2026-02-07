<script setup lang="ts">
defineProps<{
  label: string
  current: number
  total: number
}>()
</script>

<template>
  <div
    class="inline-flex items-center gap-2 rounded-full bg-gray-100 dark:bg-gray-800 px-4 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300"
    role="status"
    :aria-label="`${label} ${current} of ${total}`"
  >
    <span>{{ label }}</span>
    <span class="text-primary-600 dark:text-primary-400 font-semibold">
      {{ current }}/{{ total }}
    </span>
  </div>
</template>
