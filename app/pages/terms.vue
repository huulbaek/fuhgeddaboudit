<script setup lang="ts">
definePageMeta({ layout: 'default' })

const reqUrl = useRequestURL()
useHead({
  title: 'Terms of Service',
  link: [{ rel: 'canonical', href: `${reqUrl.origin}/terms` }],
})
useSeoMeta({
  description: 'Terms of service, privacy practices, legal disclaimers, and crisis resources for the Mnemosyne Protocol memory-dampening platform.',
})
</script>

<template>
  <div class="max-w-2xl mx-auto" data-testid="terms-page">
    <h1 class="text-3xl font-bold mb-8">Terms of Service</h1>

    <section class="space-y-4 mb-8" data-testid="section-purpose">
      <h2 class="text-xl font-semibold">Purpose &amp; Scope</h2>
      <p class="text-gray-600 dark:text-gray-400">
        Mnemosyne Protocol is a <strong>symptom management tool</strong>. It provides structured,
        evidence-based neurocognitive exercises designed to help reduce the distress associated
        with unwanted memories. It does <strong>not</strong> erase, delete, or forensically remove
        memories.
      </p>
      <p class="text-gray-600 dark:text-gray-400">
        The protocols offered (RTM, TNT, Visuospatial Interference, EMDR-inspired bilateral
        stimulation) aim to dampen the emotional intensity of traumatic memories, not to alter
        the factual content of those memories.
      </p>
    </section>

    <hr class="border-gray-200 dark:border-gray-800 mb-8" />

    <section class="space-y-4 mb-8" data-testid="section-not-therapy">
      <h2 class="text-xl font-semibold">Not a Substitute for Professional Care</h2>
      <p class="text-gray-600 dark:text-gray-400">
        This application is <strong>not</strong> a medical device, therapy platform, or
        replacement for professional mental health treatment. It is a self-guided supplemental
        tool. If you are experiencing a mental health crisis, please contact a qualified
        professional or use the crisis resources listed below.
      </p>
    </section>

    <hr class="border-gray-200 dark:border-gray-800 mb-8" />

    <section class="space-y-4 mb-8" data-testid="section-legal-proceedings">
      <h2 class="text-xl font-semibold">Legal Proceedings Warning</h2>
      <div class="p-4 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
        <p class="text-amber-800 dark:text-amber-200 font-medium mb-2">
          Important Notice for Users Involved in Legal Proceedings
        </p>
        <p class="text-amber-700 dark:text-amber-300">
          If you are currently involved in, or anticipate being involved in, any legal
          proceedings where your memory of events may be relevant (including but not limited
          to criminal cases, civil litigation, custody disputes, or insurance claims), you
          should <strong>consult with your attorney before using this application</strong>.
          Use of memory-modification techniques may affect the admissibility or credibility
          of your testimony.
        </p>
      </div>
    </section>

    <hr class="border-gray-200 dark:border-gray-800 mb-8" />

    <section class="space-y-4 mb-8" data-testid="section-data-privacy">
      <h2 class="text-xl font-semibold">Data &amp; Privacy</h2>
      <p class="text-gray-600 dark:text-gray-400">
        No raw trauma content is ever stored on our servers. We store only scores, timestamps,
        and encrypted metadata necessary for tracking your progress. Memory descriptions and
        safe-place details remain on your device only.
      </p>
    </section>

    <hr class="border-gray-200 dark:border-gray-800 mb-8" />

    <section class="space-y-4 mb-8" data-testid="section-assumption-of-risk">
      <h2 class="text-xl font-semibold">Assumption of Risk</h2>
      <p class="text-gray-600 dark:text-gray-400">
        By using this application, you acknowledge that engaging with traumatic memory content
        may cause temporary emotional distress. The application includes safety features
        (grounding exercises, distress monitoring, automatic safety interventions) but cannot
        guarantee the absence of adverse reactions. You agree to use the grounding tools
        provided and to stop any session if distress becomes unmanageable.
      </p>
    </section>

    <hr class="border-gray-200 dark:border-gray-800 mb-8" />

    <section class="space-y-4" data-testid="section-crisis-resources">
      <h2 class="text-xl font-semibold">Crisis Resources</h2>
      <div class="p-4 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
        <ul class="space-y-3">
          <li>
            <strong>988 Suicide &amp; Crisis Lifeline</strong><br />
            Call or text <strong>988</strong> — available 24/7
          </li>
          <li>
            <strong>Crisis Text Line</strong><br />
            Text <strong>HELLO</strong> to <strong>741741</strong> — free, 24/7 support
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>
