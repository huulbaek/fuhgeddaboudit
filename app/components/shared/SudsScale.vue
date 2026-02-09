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

function buttonColor(n: number): string {
  if (n <= 3) return 'cyan'
  if (n <= 6) return 'amber'
  return 'magenta'
}
</script>

<template>
  <div class="space-y-3">
    <h3 class="text-lg font-semibold">Distress Rating (SUDs)</h3>
    <p class="text-sm text-gray-400">
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
        class="suds-btn w-11 h-11 rounded-sm text-sm font-mono font-semibold transition-all focus:outline-none focus:ring-1 focus:ring-cyan-400 border"
        :class="
          selected === n - 1
            ? `suds-btn-active suds-${buttonColor(n - 1)}`
            : 'bg-gray-800/80 border-gray-700/50 text-gray-400 hover:border-gray-600 hover:text-gray-200'
        "
        @click="select(n - 1)"
      >
        {{ n - 1 }}
      </button>
    </div>

    <div class="flex justify-between text-xs text-gray-500 font-mono tracking-wider px-1">
      <span>{{ labels[0] }}</span>
      <span>{{ labels[5] }}</span>
      <span>{{ labels[10] }}</span>
    </div>
  </div>
</template>

<style scoped>
.suds-btn-active.suds-cyan {
  background: rgba(0, 212, 255, 0.15);
  border-color: rgba(0, 212, 255, 0.4);
  color: #00d4ff;
  box-shadow: 0 0 12px rgba(0, 212, 255, 0.2);
}
.suds-btn-active.suds-amber {
  background: rgba(255, 170, 0, 0.15);
  border-color: rgba(255, 170, 0, 0.4);
  color: #ffaa00;
  box-shadow: 0 0 12px rgba(255, 170, 0, 0.2);
}
.suds-btn-active.suds-magenta {
  background: rgba(255, 45, 123, 0.15);
  border-color: rgba(255, 45, 123, 0.4);
  color: #ff2d7b;
  box-shadow: 0 0 12px rgba(255, 45, 123, 0.2);
}
</style>
