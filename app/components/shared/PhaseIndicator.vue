<script setup lang="ts">
defineProps<{
  label: string
  current: number
  total: number
}>()
</script>

<template>
  <div
    class="inline-flex items-center gap-2 rounded-sm bg-surface border border-gray-700/50 px-4 py-1.5 text-sm font-mono tracking-wide text-gray-300"
    role="status"
    :aria-label="`${label} ${current} of ${total}`"
  >
    <span>{{ label }}</span>
    <span class="text-cyan-400 font-semibold text-glow-cyan">
      {{ current }}/{{ total }}
    </span>
  </div>
</template>
