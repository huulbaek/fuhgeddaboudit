<script setup lang="ts">
const { isLoggedIn, logout } = useAuth()
</script>

<template>
  <div class="min-h-screen">
    <header class="border-b border-gray-200 dark:border-gray-800">
      <nav class="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <NuxtLink to="/" class="text-lg font-semibold">Mnemosyne</NuxtLink>
        <div class="flex items-center gap-4">
          <template v-if="isLoggedIn">
            <NuxtLink to="/progress">Progress</NuxtLink>
            <UButton variant="ghost" size="sm" @click="logout()">Log out</UButton>
          </template>
          <template v-else>
            <NuxtLink to="/auth/login">Log in</NuxtLink>
            <UButton to="/auth/register" size="sm">Register</UButton>
          </template>
        </div>
      </nav>
    </header>
    <GroundingPanicButton />
    <GroundingGroundingOverlay />
    <main class="max-w-5xl mx-auto px-4 py-8">
      <slot />
    </main>
  </div>
</template>
