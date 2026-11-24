<script setup lang="ts">
const inactivity = useInactivityGrounding()

onMounted(() => {
  inactivity.start()
})

onUnmounted(() => {
  inactivity.stop()
})
</script>

<template>
  <div class="min-h-screen flex flex-col bg-void bg-grid">
    <GroundingOverlay />
    <SharedPulseMonitor />
    <div class="flex-1">
      <slot />
    </div>
  </div>
</template>
