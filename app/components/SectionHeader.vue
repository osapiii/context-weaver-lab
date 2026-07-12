<template>
  <div
    :class="[
      'w-full',
      variant === 'compact' ? 'mb-4 mt-6' : 'mb-8 mt-12',
    ]"
  >
    <div
      :class="[
        'flex items-center gap-3',
        variant === 'compact' ? 'mb-1.5' : 'mb-2 gap-4',
      ]"
    >
      <div
        :class="[
          'font-extrabold text-slate-800',
          variant === 'compact' ? 'text-2xl' : 'text-5xl',
        ]"
      >
        {{ sectionNumber }}.
      </div>
      <div
        :class="[
          'font-bold text-slate-800',
          variant === 'compact' ? 'text-xl' : 'text-4xl',
        ]"
      >
        {{ title }}
      </div>
    </div>
    <div
      :class="[
        'bg-slate-300',
        variant === 'compact' ? 'h-px' : 'h-0.5',
      ]"
    />
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    sectionNumber: number;
    title: string;
    variant?: "default" | "compact";
  }>(),
  {
    variant: "default",
  }
);
</script>
