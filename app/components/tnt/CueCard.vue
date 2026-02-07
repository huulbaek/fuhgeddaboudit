<script setup lang="ts">
interface Cue {
  id: string
  src: string
  name: string
}

const props = defineProps<{
  cue: Cue
  condition: 'think' | 'no-think'
}>()

const borderClass = computed(() =>
  props.condition === 'think'
    ? 'border-green-500'
    : 'border-red-500',
)

const label = computed(() =>
  props.condition === 'think' ? 'Think' : 'No-Think',
)
</script>

<template>
  <div
    class="inline-flex flex-col items-center gap-2"
    :data-testid="`cue-card-${condition}`"
    role="img"
    :aria-label="`${cue.name} — ${label}`"
  >
    <div
      class="w-48 h-48 rounded-xl border-4 flex items-center justify-center bg-white dark:bg-gray-800 overflow-hidden"
      :class="borderClass"
    >
      <img
        :src="cue.src"
        :alt="cue.name"
        class="max-w-full max-h-full object-contain"
      />
    </div>
    <span
      class="text-sm font-semibold"
      :class="condition === 'think' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
    >
      {{ label }}
    </span>
  </div>
</template>
