<script setup lang="ts">
const { isGrounding, dismiss } = useGrounding()

const steps = [
  { count: 5, sense: 'things you can SEE' },
  { count: 4, sense: 'things you can TOUCH' },
  { count: 3, sense: 'things you can HEAR' },
  { count: 2, sense: 'things you can SMELL' },
  { count: 1, sense: 'thing you can TASTE' },
]
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="isGrounding"
        class="fixed inset-0 z-[100] bg-emerald-50 dark:bg-emerald-950 flex flex-col items-center justify-center p-8 overflow-y-auto"
      >
        <div class="max-w-lg text-center space-y-8">
          <h2 class="text-3xl font-bold text-emerald-800 dark:text-emerald-200">
            You are safe. You are here.
          </h2>
          <p class="text-lg text-emerald-700 dark:text-emerald-300">
            Take a slow breath. Focus on what's around you right now.
          </p>
          <div class="space-y-4 text-left">
            <div
              v-for="step in steps"
              :key="step.count"
              class="p-4 rounded-lg bg-emerald-100 dark:bg-emerald-900"
            >
              <span class="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mr-3">
                {{ step.count }}
              </span>
              <span class="text-emerald-800 dark:text-emerald-200">{{ step.sense }}</span>
            </div>
          </div>
          <UButton size="lg" color="neutral" variant="solid" @click="dismiss()">
            I feel grounded — continue
          </UButton>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
