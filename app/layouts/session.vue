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
  <div class="min-h-screen flex flex-col">
    <GroundingPanicButton />
    <GroundingGroundingOverlay />
    <div class="flex-1">
      <slot />
    </div>
    <SharedCrisisFooter />
  </div>
</template>
