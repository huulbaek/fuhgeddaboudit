<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { login } = useAuth()
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleSubmit() {
  error.value = ''
  loading.value = true
  try {
    await login(email.value, password.value)
    navigateTo('/')
  } catch (e: any) {
    error.value = e.data?.message || e.statusMessage || 'Login failed'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <div class="space-y-2 text-center">
      <h1 class="text-2xl font-bold">Log In</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400">
        Continue your protocol from where you left off.
      </p>
    </div>
    <form @submit.prevent="handleSubmit" class="space-y-4 sm:space-y-5">
      <UFormField label="Email">
        <UInput v-model="email" type="email" placeholder="you@example.com" required class="w-full" />
      </UFormField>
      <UFormField label="Password">
        <UInput v-model="password" type="password" placeholder="Your password" required class="w-full" />
      </UFormField>
      <p v-if="error" class="text-red-500 text-sm">{{ error }}</p>
      <UButton type="submit" size="lg" block :loading="loading">Log In</UButton>
      <p class="text-center text-sm text-gray-500">
        Don't have an account?
        <NuxtLink to="/auth/register" class="text-primary underline">Register</NuxtLink>
      </p>
    </form>
  </div>
</template>
