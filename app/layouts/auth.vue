<template>
  <div class="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950 px-2 sm:px-4 py-4 sm:py-8">
    <div class="flex-1 flex items-start sm:items-center justify-center py-4 sm:py-0">
      <div class="w-full max-w-md">
        <UCard>
          <slot />
        </UCard>
      </div>
    </div>
    <SharedCrisisFooter />
  </div>
</template>
