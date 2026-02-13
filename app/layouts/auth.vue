<template>
  <div class="min-h-screen flex flex-col bg-void bg-grid-perspective px-2 sm:px-4 py-4 sm:py-8">
    <div class="flex-1 flex items-start sm:items-center justify-center py-4 sm:py-0">
      <div class="w-full max-w-md">
        <!-- Terminal-style card -->
        <div class="border-glow bg-surface/90 backdrop-blur-sm p-6 sm:p-8 rounded-sm">
          <!-- Terminal header bar -->
          <div class="flex items-center gap-2 mb-6 pb-4 border-b border-gray-700/50">
            <div class="flex gap-1.5">
              <NuxtLink to="/" aria-label="Close" class="w-2.5 h-2.5 rounded-full bg-red-400/60 hover:bg-red-400 transition-colors cursor-pointer"></NuxtLink>
              <span class="w-2.5 h-2.5 rounded-full bg-yellow-400/60"></span>
              <span class="w-2.5 h-2.5 rounded-full bg-green-400/60"></span>
            </div>
            <span class="font-mono text-xs text-gray-500 tracking-wider ml-2">MNEMOSYNE PROTOCOL v2.1</span>
          </div>
          <slot />
        </div>
      </div>
    </div>
    <SharedCrisisFooter />
  </div>
</template>
