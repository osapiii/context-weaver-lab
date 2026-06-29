<template>
  <div
    class="relative group"
    :class="
      selected
        ? 'rounded-2xl ring-2 ring-purple-400 ring-offset-2 ring-offset-transparent'
        : ''
    "
  >
    <button
      type="button"
      class="flex w-full flex-col overflow-hidden rounded-2xl bg-white text-left shadow-sm ring-1 ring-gray-900/[0.06] transition hover:-translate-y-0.5 hover:shadow-md hover:ring-purple-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 dark:bg-gray-900 dark:ring-white/10"
      @click="emit('click')"
    >
      <div class="relative h-[96px] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
        <ConsultationKnowledgeListThumb
          :document="document"
          size="banner"
        />
        <KnowledgeDocumentStatusBadges :document="document" />
      </div>
      <div class="space-y-0.5 px-2.5 py-2">
        <p
          class="truncate text-xs font-bold text-gray-800 dark:text-gray-100"
          :title="displayName"
        >
          {{ displayName }}
        </p>
        <p class="truncate text-[10px] text-gray-400 tabular-nums">
          {{ sizeLabel }}
          <span v-if="updatedLabel"> · {{ updatedLabel }}</span>
        </p>
      </div>
    </button>

    <button
      v-if="showActions && enableSelection"
      type="button"
      :aria-label="selected ? '選択を解除' : '一括削除のために選択'"
      :aria-pressed="selected"
      :class="[
        'absolute top-2 right-2 z-20 flex h-6 w-6 items-center justify-center rounded-md ring-1 backdrop-blur-sm shadow-sm transition-all duration-150',
        selected
          ? 'bg-purple-500 ring-purple-500 text-white'
          : 'bg-white/95 ring-gray-300 text-gray-300 hover:ring-purple-400 hover:text-purple-500',
      ]"
      @click.stop="emit('toggle')"
    >
      <UIcon name="i-heroicons-check" class="h-4 w-4" />
    </button>

    <UButton
      v-if="showActions"
      icon="i-heroicons-trash"
      color="error"
      variant="soft"
      size="xs"
      :class="[
        'absolute top-2 z-20 opacity-70 hover:opacity-100',
        enableSelection ? 'right-10' : 'right-2',
      ]"
      @click.stop="emit('delete')"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Document } from "@models/document";
import ConsultationKnowledgeListThumb from "@components/AgentWorkspace/ConsultationKnowledgeListThumb.vue";
import KnowledgeDocumentStatusBadges from "@components/knowledge/KnowledgeDocumentStatusBadges.vue";
import {
  formatKnowledgeBytes,
  knowledgeDocumentName,
  knowledgeDocumentSizeBytes,
} from "@utils/consultationKnowledge";
import { formatTimestamp } from "@utils/date";

const props = withDefaults(
  defineProps<{
    document: Document;
    enableSelection?: boolean;
    selected?: boolean;
    showActions?: boolean;
  }>(),
  {
    enableSelection: false,
    selected: false,
    showActions: true,
  }
);

const emit = defineEmits<{
  click: [];
  delete: [];
  toggle: [];
}>();

const displayName = computed(() => knowledgeDocumentName(props.document));

const sizeLabel = computed(() => {
  const bytes = knowledgeDocumentSizeBytes(props.document);
  return formatKnowledgeBytes(bytes);
});

const updatedLabel = computed(() => {
  const raw = props.document.updateTime || props.document.createTime;
  if (!raw) return "";
  return formatTimestamp(raw);
});

</script>
