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
        class="fixed inset-0 z-[100] flex flex-col items-center justify-center p-8 overflow-y-auto grounding-bg"
      >
        <div class="max-w-lg text-center space-y-8">
          <h2 class="text-3xl font-bold text-emerald-200 text-glow-green">
            You are safe. You are here.
          </h2>
          <p class="text-lg text-emerald-300/80">
            Take a slow breath. Focus on what's around you right now.
          </p>
          <div class="space-y-3 text-left stagger-children">
            <div
              v-for="step in steps"
              :key="step.count"
              class="p-4 rounded-sm bg-emerald-900/30 border border-emerald-400/15 flex items-center gap-3"
            >
              <span class="text-2xl font-mono font-bold text-emerald-400 text-glow-green min-w-8 text-center">
                {{ step.count }}
              </span>
              <span class="text-emerald-200">{{ step.sense }}</span>
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
.grounding-bg {
  background: radial-gradient(ellipse at center, #0a3520 0%, #051c10 50%, #08090f 100%);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
