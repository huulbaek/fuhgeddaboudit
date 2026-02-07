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
  <div>
    <h1 class="text-2xl font-bold mb-6 text-center">Create Account</h1>
    <form @submit.prevent="handleSubmit" class="space-y-4">
      <UFormField label="Email">
        <UInput v-model="email" type="email" placeholder="you@example.com" required />
      </UFormField>
      <UFormField label="Password">
        <UInput v-model="password" type="password" placeholder="Min 8 characters" required />
      </UFormField>
      <p v-if="error" class="text-red-500 text-sm">{{ error }}</p>
      <UButton type="submit" block :loading="loading">Register</UButton>
      <p class="text-center text-sm text-gray-500">
        Already have an account?
        <NuxtLink to="/auth/login" class="text-primary underline">Log in</NuxtLink>
      </p>
    </form>
  </div>
</template>
