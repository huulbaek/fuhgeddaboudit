<template>
  <div class="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950 px-4">
    <div class="flex-1 flex items-center justify-center">
      <div class="w-full max-w-md">
        <UCard>
          <slot />
        </UCard>
      </div>
    </div>
    <SharedCrisisFooter />
  </div>
</template>
