<template>
  <div
    :class="[
      'sticky-note relative flex flex-col rounded-md p-3.5',
      stateClass,
      `tone-${tone}`,
      isEditable ? 'cursor-pointer hover:scale-[1.03]' : '',
    ]"
    :role="isEditable ? 'button' : undefined"
    :tabindex="isEditable ? 0 : -1"
    :aria-label="ariaLabel"
    @click="onClick"
    @keydown.enter.prevent="onClick"
  >
    <!-- ヘッダー: 番号 + ラベル -->
    <div
      class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider"
      :class="labelClass"
    >
      <span
        class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/60 text-[10px] font-extrabold ring-1 ring-black/5"
      >
        {{ index }}
      </span>
      <span class="truncate">{{ label }}</span>
      <UIcon
        v-if="isEditable"
        name="material-symbols:edit-outline"
        class="ml-auto h-4 w-4 opacity-0 transition group-hover:opacity-100"
      />
    </div>

    <!-- 内容 -->
    <div class="mt-2 min-h-[3rem] flex-1">
      <div
        v-if="state === 'empty'"
        class="flex h-full flex-col items-center justify-center gap-0.5 text-neutral-300"
      >
        <span class="text-2xl font-light leading-none">?</span>
        <span class="text-[10px] tracking-wider">まだ</span>
      </div>

      <div
        v-else-if="state === 'active'"
        class="flex h-full items-center justify-center text-sm italic"
        :class="activeTextClass"
      >
        記入中…
      </div>

      <!-- text 値 -->
      <p
        v-else-if="typeof value === 'string'"
        class="whitespace-pre-wrap break-words text-sm leading-snug text-neutral-800"
      >
        {{ value }}
      </p>

      <!-- chip 値 -->
      <div v-else-if="Array.isArray(value)" class="flex flex-wrap gap-1.5">
        <span
          v-for="(v, i) in value"
          :key="`${index}-${i}`"
          class="inline-flex rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-medium text-neutral-700 ring-1 ring-black/5"
        >
          {{ v }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

type Tone = "purple" | "lime" | "sky" | "rose" | "violet";
type State = "empty" | "active" | "filled";

const props = withDefaults(
  defineProps<{
    index: number;
    label: string;
    value: string | string[] | undefined;
    state: State;
    editable?: boolean;
    tone?: Tone;
  }>(),
  {
    editable: false,
    tone: "purple",
  }
);

const emit = defineEmits<{ (e: "edit"): void }>();

const isEditable = computed(() => props.editable && props.state === "filled");

const stateClass = computed(() => {
  switch (props.state) {
    case "filled":
      return "shadow-sm ring-1 ring-black/5";
    case "active":
      return "ring-2 ring-offset-1 ring-current";
    case "empty":
    default:
      return "border border-dashed border-neutral-300 bg-white/40";
  }
});

const tone = computed(() => props.tone);

const labelClass = computed(() => {
  if (props.state === "empty") return "text-neutral-400";
  switch (props.tone) {
    case "lime":
      return "text-lime-800";
    case "sky":
      return "text-sky-800";
    case "rose":
      return "text-rose-800";
    case "violet":
      return "text-violet-800";
    case "purple":
    default:
      return "text-purple-800";
  }
});

const activeTextClass = computed(() => {
  switch (props.tone) {
    case "lime":
      return "text-lime-600";
    case "sky":
      return "text-sky-600";
    case "rose":
      return "text-rose-600";
    case "violet":
      return "text-violet-600";
    case "purple":
    default:
      return "text-purple-600";
  }
});

const ariaLabel = computed(() =>
  isEditable.value ? `${props.label} を編集` : props.label
);

const onClick = () => {
  if (!isEditable.value) return;
  emit("edit");
};
</script>

<style scoped>
.sticky-note {
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease;
}
.tone-purple {
  background: linear-gradient(180deg, #fffbeb 0%, #fef3c7 100%);
}
.tone-lime {
  background: linear-gradient(180deg, #f7fee7 0%, #ecfccb 100%);
}
.tone-sky {
  background: linear-gradient(180deg, #f0f9ff 0%, #e0f2fe 100%);
}
.tone-rose {
  background: linear-gradient(180deg, #fff1f2 0%, #ffe4e6 100%);
}
.tone-violet {
  background: linear-gradient(180deg, #f5f3ff 0%, #ede9fe 100%);
}
</style>
