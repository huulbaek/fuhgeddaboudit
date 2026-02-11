// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-05-01',
  devtools: { enabled: true },
  modules: ['@nuxt/ui', '@nuxt/test-utils/module'],
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
      titleTemplate: '%s | Mnemosyne Protocol',
      meta: [
        { name: 'theme-color', content: '#08090f' },
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'Mnemosyne Protocol' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { property: 'og:image', content: 'https://forgetaboutit.io/og-image.png' },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:image:alt', content: 'Mnemosyne Protocol — Neurocognitive Memory Protocol' },
        { name: 'twitter:image', content: 'https://forgetaboutit.io/og-image.png' },
        { name: 'twitter:image:alt', content: 'Mnemosyne Protocol — Neurocognitive Memory Protocol' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
        { rel: 'icon', href: '/favicon.ico', sizes: 'any' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
      ],
    },
  },
  ui: {
    fonts: false,
  },
  colorMode: {
    preference: 'dark',
  },
  runtimeConfig: {
    public: {
      screeningEnabled: false, // override with NUXT_PUBLIC_SCREENING_ENABLED=true
    },
  },
  css: ['~/assets/css/main.css'],
  nitro: {
    routeRules: {
      '/**': {
        headers: {
          'Content-Security-Policy': [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            "font-src 'self' data:",
            "connect-src 'self' https://tfhub.dev https://storage.googleapis.com https://www.kaggle.com",
            "media-src 'self' blob:",
            "object-src 'none'",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
          ].join('; '),
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
        },
      },
    },
  },
})
