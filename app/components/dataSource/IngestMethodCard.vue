<template>
  <section
    :class="[
      layout === 'tile'
        ? 'ingest-tile flex h-full min-h-0 flex-col rounded-2xl bg-white/90 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-gray-900/[0.05] backdrop-blur-sm transition-shadow dark:bg-gray-900/70 dark:ring-white/10'
        : 'space-y-3',
      layout === 'tile' ? bodyHoverClass : '',
    ]"
  >
    <div
      class="flex items-start gap-3.5"
      :class="layout === 'tile' ? 'shrink-0 px-4 pb-1 pt-4' : ''"
    >
      <div
        class="flex shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 ring-inset"
        :class="[
          iconTileClass,
          layout === 'tile' ? 'h-11 w-11' : 'h-10 w-10',
        ]"
      >
        <UIcon
          :name="icon"
          :class="[
            iconClass,
            layout === 'tile' ? 'h-6 w-6' : 'h-5 w-5',
          ]"
        />
      </div>
      <div class="min-w-0 flex-1 pt-0.5">
        <h3
          class="tracking-tight text-gray-900 dark:text-white"
          :class="titleClass"
        >
          {{ title }}
        </h3>
        <p
          v-if="subtitle"
          class="mt-1 leading-snug text-gray-500 dark:text-gray-400"
          :class="layout === 'tile' ? 'text-xs' : 'mt-0.5 text-xs'"
        >
          {{ subtitle }}
        </p>
      </div>
    </div>

    <div
      v-if="layout === 'tile'"
      class="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3"
    >
      <slot />
    </div>
    <div
      v-else-if="!bare"
      class="rounded-2xl bg-white/80 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-gray-900/[0.05] backdrop-blur-sm transition-shadow dark:bg-gray-900/60 dark:ring-white/10"
      :class="bodyHoverClass"
    >
      <slot />
    </div>
    <slot v-else />
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";

export type IngestMethodTone = "emerald" | "teal" | "purple" | "violet" | "blue" | "sky";

const props = withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    icon: string;
    tone?: IngestMethodTone;
    /** true のとき内側のカード枠を付けず slot のみ (A の D&D など) */
    bare?: boolean;
    /** 2x2 タイル用: ヘッダー + body を 1 枚のカードに統合 */
    layout?: "default" | "tile";
  }>(),
  {
    tone: "emerald",
    subtitle: "",
    bare: false,
    layout: "default",
  }
);

const iconTileClass = computed(() => {
  const map: Record<IngestMethodTone, string> = {
    emerald: "bg-emerald-50 ring-emerald-200/80 dark:bg-emerald-950/40 dark:ring-emerald-800/50",
    teal: "bg-teal-50 ring-teal-200/80 dark:bg-teal-950/40 dark:ring-teal-800/50",
    purple: "bg-purple-50 ring-purple-200/80 dark:bg-purple-950/40 dark:ring-purple-800/50",
    violet: "bg-violet-50 ring-violet-200/80 dark:bg-violet-950/40 dark:ring-violet-800/50",
    blue: "bg-blue-50 ring-blue-200/80 dark:bg-blue-950/40 dark:ring-blue-800/50",
    sky: "bg-sky-50 ring-sky-200/80 dark:bg-sky-950/40 dark:ring-sky-800/50",
  };
  return map[props.tone];
});

const iconClass = computed(() => {
  const map: Record<IngestMethodTone, string> = {
    emerald: "text-emerald-600 dark:text-emerald-400",
    teal: "text-teal-600 dark:text-teal-400",
    purple: "text-purple-600 dark:text-purple-400",
    violet: "text-violet-600 dark:text-violet-400",
    blue: "text-blue-600 dark:text-blue-400",
    sky: "text-sky-600 dark:text-sky-400",
  };
  return map[props.tone];
});

const bodyHoverClass = computed(() => {
  const map: Record<IngestMethodTone, string> = {
    emerald: "hover:shadow-[0_4px_20px_-8px_rgba(16,185,129,0.18)]",
    teal: "hover:shadow-[0_4px_20px_-8px_rgba(20,184,166,0.18)]",
    purple: "hover:shadow-[0_4px_20px_-8px_rgba(139,92,246,0.15)]",
    violet: "hover:shadow-[0_4px_20px_-8px_rgba(124,58,237,0.15)]",
    blue: "hover:shadow-[0_4px_20px_-8px_rgba(37,99,235,0.15)]",
    sky: "hover:shadow-[0_4px_20px_-8px_rgba(14,165,233,0.18)]",
  };
  return map[props.tone];
});

const titleClass = computed(() =>
  props.layout === "tile"
    ? "text-lg font-extrabold leading-snug"
    : "text-sm font-bold"
);
</script>
