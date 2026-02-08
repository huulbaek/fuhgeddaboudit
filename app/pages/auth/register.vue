<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { register } = useAuth()
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleSubmit() {
  error.value = ''
  loading.value = true
  try {
    await register(email.value, password.value)
    navigateTo('/')
  } catch (e: any) {
    error.value = e.data?.message || e.statusMessage || 'Registration failed'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <div class="space-y-2 text-center">
      <h1 class="text-2xl font-bold">Create Account</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400">
        Set up your account to start guided protocols safely.
      </p>
    </div>
    <form @submit.prevent="handleSubmit" class="space-y-4 sm:space-y-5">
      <UFormField label="Email">
        <UInput v-model="email" type="email" placeholder="you@example.com" required class="w-full" />
      </UFormField>
      <UFormField label="Password">
        <UInput v-model="password" type="password" placeholder="Min 8 characters" required class="w-full" />
      </UFormField>
      <p v-if="error" class="text-red-500 text-sm">{{ error }}</p>
      <UButton type="submit" size="lg" block :loading="loading">Register</UButton>
      <p class="text-center text-sm text-gray-500">
        Already have an account?
        <NuxtLink to="/auth/login" class="text-primary underline">Log in</NuxtLink>
      </p>
    </form>
  </div>
</template>
