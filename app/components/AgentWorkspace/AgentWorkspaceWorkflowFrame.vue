<template>
  <div class="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
    <div
      v-if="$slots.stepper"
      class="flex-shrink-0 border-b border-neutral-200 bg-white/90 px-2 py-2"
      data-testid="ai-workflow-stepper-header"
    >
      <div class="mx-auto w-full max-w-[min(98vw,1920px)] overflow-x-auto">
        <div class="min-w-[32rem]">
          <slot name="stepper" />
        </div>
      </div>
    </div>

    <slot />
  </div>
</template>
