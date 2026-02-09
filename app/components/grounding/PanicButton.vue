<script setup lang="ts">
const { trigger } = useGrounding()
const isPressed = ref(false)

function handlePress() {
  isPressed.value = true
  trigger('panic-button')
  setTimeout(() => { isPressed.value = false }, 200)
}
</script>

<template>
  <!-- Recessed housing / bezel -->
  <div class="panic-housing fixed z-50">
    <!-- Radar ping on idle -->
    <span class="panic-ping" />
    <!-- The raised button dome -->
    <button
      @click="handlePress"
      :class="['panic-dome', { 'panic-dome--pressed': isPressed }]"
      aria-label="Grounding — I need to feel safe"
      title="Grounding — press if you need to feel safe"
    >
      <span class="panic-label">SOS</span>
    </button>
  </div>
</template>

<style scoped>
/* ---- Housing: the recessed ring around the button ---- */
.panic-housing {
  bottom: max(1rem, env(safe-area-inset-bottom));
  right: max(1rem, env(safe-area-inset-right));
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: radial-gradient(circle at 40% 35%, #1a2a22, #0a1510);
  box-shadow:
    inset 0 2px 8px rgba(0, 0, 0, 0.7),
    inset 0 0 2px rgba(0, 255, 135, 0.1),
    0 0 20px rgba(0, 255, 135, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid rgba(0, 255, 135, 0.15);
}

@media (min-width: 640px) {
  .panic-housing {
    bottom: max(1.5rem, env(safe-area-inset-bottom));
    right: max(1.5rem, env(safe-area-inset-right));
    width: 72px;
    height: 72px;
  }
}

/* ---- Ping ring: radar pulse radiating outward ---- */
.panic-ping {
  position: absolute;
  inset: -2px;
  border-radius: 50%;
  border: 1.5px solid rgba(0, 255, 135, 0.25);
  animation: panic-radar 3s ease-out infinite;
  pointer-events: none;
}

@keyframes panic-radar {
  0% {
    transform: scale(1);
    opacity: 0.6;
  }
  100% {
    transform: scale(1.8);
    opacity: 0;
  }
}

/* ---- Dome: the raised 3D button surface ---- */
.panic-dome {
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.1s ease, box-shadow 0.1s ease;

  /* 3D raised dome gradient */
  background:
    radial-gradient(ellipse 70% 50% at 45% 30%, rgba(160, 244, 208, 0.25), transparent 60%),
    radial-gradient(circle at 50% 50%, #10b878, #067848 70%, #045830);

  /* Raised shadow stack */
  box-shadow:
    /* Top highlight rim */
    inset 0 2px 3px rgba(160, 244, 208, 0.3),
    /* Bottom inner shadow for depth */
    inset 0 -3px 5px rgba(0, 0, 0, 0.4),
    /* Outer drop shadow (elevated) */
    0 4px 6px rgba(0, 0, 0, 0.5),
    0 2px 3px rgba(0, 0, 0, 0.3),
    /* Green glow */
    0 0 15px rgba(0, 255, 135, 0.15);

  transform: translateY(-2px);
}

@media (min-width: 640px) {
  .panic-dome {
    width: 54px;
    height: 54px;
  }
}

.panic-dome:hover {
  background:
    radial-gradient(ellipse 70% 50% at 45% 30%, rgba(160, 244, 208, 0.35), transparent 60%),
    radial-gradient(circle at 50% 50%, #30d090, #10b878 70%, #067848);
  box-shadow:
    inset 0 2px 3px rgba(160, 244, 208, 0.4),
    inset 0 -3px 5px rgba(0, 0, 0, 0.4),
    0 4px 6px rgba(0, 0, 0, 0.5),
    0 2px 3px rgba(0, 0, 0, 0.3),
    0 0 25px rgba(0, 255, 135, 0.25),
    0 0 50px rgba(0, 255, 135, 0.08);
}

/* Pressed state — dome pushes down into housing */
.panic-dome--pressed {
  transform: translateY(1px);
  box-shadow:
    inset 0 1px 2px rgba(160, 244, 208, 0.15),
    inset 0 -1px 2px rgba(0, 0, 0, 0.3),
    0 1px 2px rgba(0, 0, 0, 0.4),
    0 0 20px rgba(0, 255, 135, 0.3);
}

/* ---- Label ---- */
.panic-label {
  font-family: var(--font-family-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: rgba(255, 255, 255, 0.95);
  text-shadow:
    0 0 8px rgba(0, 255, 135, 0.6),
    0 1px 1px rgba(0, 0, 0, 0.5);
  user-select: none;
  pointer-events: none;
}

/* ---- Reduce motion ---- */
@media (prefers-reduced-motion: reduce) {
  .panic-ping {
    animation: none;
    opacity: 0.3;
  }
  .panic-dome {
    transition: none;
  }
}
</style>
