<script setup lang="ts">
const emit = defineEmits<{
  select: [rating: number]
}>()

const props = defineProps<{
  modelValue?: number | null
  disabled?: boolean
}>()

const selected = ref<number | null>(props.modelValue ?? null)

watch(
  () => props.modelValue,
  (v) => {
    selected.value = v ?? null
  },
)

const labels: Record<number, string> = {
  0: 'None',
  5: 'Moderate',
  10: 'Worst',
}

function select(rating: number) {
  if (props.disabled) return
  selected.value = rating
  emit('select', rating)
}
</script>

<template>
  <div class="space-y-3">
    <h3 class="text-lg font-semibold">Distress Rating (SUDs)</h3>
    <p class="text-sm text-gray-500 dark:text-gray-400">
      Rate your current level of distress from 0 (no distress) to 10 (worst
      distress imaginable).
    </p>

    <div class="flex flex-wrap gap-2 justify-center">
      <button
        v-for="n in 11"
        :key="n - 1"
        type="button"
        :disabled="disabled"
        :aria-label="`Rate distress ${n - 1} out of 10`"
        :aria-pressed="selected === n - 1"
        class="w-11 h-11 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
        :class="
          selected === n - 1
            ? 'bg-primary-600 text-white'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
        "
        @click="select(n - 1)"
      >
        {{ n - 1 }}
      </button>
    </div>

    <div class="flex justify-between text-xs text-gray-400 px-1">
      <span>{{ labels[0] }}</span>
      <span>{{ labels[5] }}</span>
      <span>{{ labels[10] }}</span>
    </div>
  </div>
</template>
