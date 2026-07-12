<template>
  <div class="penguin-mini relative inline-flex h-6 w-6 items-center justify-center">
    <NuxtImg
      src="/en-ai-avatar-violet.png"
      alt="リサーチ AI バディ"
      class="penguin-mini-img h-6 w-6 object-contain"
      :class="{
        'penguin-mini-bobbing': !isBusy,
        'penguin-mini-thinking': isBusy,
      }"
    />
    <!-- sparkle badge (busy 中は虫眼鏡, idle は ✨) -->
    <span
      class="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-purple-400 shadow-sm"
      :class="{ 'animate-pulse': !isBusy, 'animate-spin-slow': isBusy }"
    >
      <UIcon
        :name="isBusy ? 'i-heroicons-magnifying-glass' : 'i-heroicons-sparkles'"
        class="h-2 w-2 text-white"
      />
    </span>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    /** 走行中 (SSE / auto reply / polling 進行中) なら true */
    isBusy?: boolean;
  }>(),
  { isBusy: false },
);
</script>

<style scoped>
.penguin-mini-img {
  will-change: transform;
}
.penguin-mini-bobbing {
  animation: penguin-mini-bob 3.6s ease-in-out infinite;
}
@keyframes penguin-mini-bob {
  0%,
  100% {
    transform: translateY(0) rotate(-2deg);
  }
  50% {
    transform: translateY(-2px) rotate(2deg);
  }
}
.penguin-mini-thinking {
  animation: penguin-mini-think 1.1s ease-in-out infinite;
}
@keyframes penguin-mini-think {
  0%,
  100% {
    transform: translateY(0) scale(1) rotate(-3deg);
  }
  50% {
    transform: translateY(-1px) scale(1.05) rotate(3deg);
  }
}
.animate-spin-slow {
  animation: spin-slow 2.4s linear infinite;
}
@keyframes spin-slow {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .penguin-mini-bobbing,
  .penguin-mini-thinking,
  .animate-spin-slow {
    animation: none;
  }
}
</style>
