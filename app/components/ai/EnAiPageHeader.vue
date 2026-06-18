<template>
  <header class="flex flex-wrap items-center gap-4">
    <div class="flex min-w-0 items-center gap-4">
      <UIcon
        :name="icon"
        class="h-12 w-12 flex-shrink-0"
        :class="iconClass"
      />
      <div class="min-w-0">
        <h1 class="text-3xl font-extrabold tracking-tight text-slate-900">
          {{ title }}
        </h1>
        <p
          v-if="subtitle"
          class="mt-1 hidden text-sm text-slate-600 md:block"
        >
          {{ subtitle }}
        </p>
      </div>
    </div>
    <div v-if="$slots.trailing" class="ml-auto flex flex-wrap items-center gap-2">
      <slot name="trailing" />
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { isMulticolorNavIcon } from "@composables/useNavModeIcons";

const props = withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    icon: string;
    /** @deprecated カラーアイコン直出しのため未使用（後方互換のみ） */
    iconGradient?: string;
  }>(),
  {
    subtitle: undefined,
    iconGradient: "from-emerald-500 to-emerald-600",
  }
);

const iconClass = computed(() =>
  isMulticolorNavIcon(props.icon) ? "" : "text-slate-600"
);
</script>
