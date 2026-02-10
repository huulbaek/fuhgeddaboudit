<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const reqUrl = useRequestURL()
useHead({
  title: 'Create Account',
  link: [{ rel: 'canonical', href: `${reqUrl.origin}/auth/register` }],
})
useSeoMeta({
  description: 'Create a free Mnemosyne Protocol account to begin guided neurocognitive memory-dampening sessions.',
})

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
    <div class="space-y-2">
      <p class="font-mono text-xs text-gray-500 tracking-wide uppercase">New Operator Registration</p>
      <h1 class="text-2xl font-bold text-ghost text-glow-cyan cursor-blink">Create Account</h1>
    </div>
    <form @submit.prevent="handleSubmit" class="space-y-4 sm:space-y-5">
      <UFormField label="Email">
        <UInput v-model="email" type="email" placeholder="operator@example.com" required class="w-full" />
      </UFormField>
      <UFormField label="Password">
        <UInput v-model="password" type="password" placeholder="Min 8 characters" required class="w-full" />
      </UFormField>
      <p v-if="error" class="text-red-400 text-sm font-mono">{{ error }}</p>
      <UButton type="submit" size="lg" block :loading="loading">Initialize Account</UButton>
      <p class="text-center text-sm text-gray-500">
        Already registered?
        <NuxtLink to="/auth/login" class="text-cyan-400 hover:text-cyan-300">Log in</NuxtLink>
      </p>
    </form>
  </div>
</template>
