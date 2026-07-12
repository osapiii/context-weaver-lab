<template>
  <div
    class="space-y-3"
    data-testid="writing-filled-result-panel"
  >
    <div
      v-if="loading"
      class="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2.5 text-xs text-emerald-900"
      role="status"
      aria-live="polite"
    >
      <UIcon
        name="material-symbols:progress-activity"
        class="h-4 w-4 shrink-0 animate-spin text-emerald-600"
      />
      入力結果を読み込んでいます…
    </div>

    <div
      v-if="!loading && displayFields.length > 0"
      class="flex flex-wrap items-center gap-2"
      data-testid="writing-filled-csv-actions"
    >
      <EnButton
        variant="outline"
        size="xs"
        leading-icon="material-symbols:content-copy"
        @click="onCopyCsv"
      >
        テキストとしてコピー（CSV形式）
      </EnButton>
      <EnButton
        variant="solid"
        color="success"
        size="xs"
        leading-icon="material-symbols:download"
        @click="onDownloadCsv"
      >
        CSV をダウンロード
      </EnButton>
    </div>

    <ul
      class="max-h-[min(56vh,32rem)] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-emerald-100 bg-white shadow-sm ring-1 ring-emerald-50"
    >
      <li
        v-for="field in displayFields"
        :key="field.key"
        class="px-3 py-2.5 sm:px-3.5 sm:py-3"
        :data-testid="`writing-filled-field-${field.key}`"
      >
        <div class="flex items-center gap-2">
          <p class="min-w-0 flex-1 truncate text-xs font-semibold text-slate-800">
            {{ field.label }}
          </p>
          <EnBadge variant="tag" size="xs" custom-class="shrink-0">
            {{ lengthLabel(field.type) }}
          </EnBadge>
          <EnButton
            variant="soft"
            color="neutral"
            size="sm"
            leading-icon="material-symbols:content-copy"
            custom-class="shrink-0"
            :title="`${field.label} をコピー`"
            :data-testid="`writing-filled-copy-${field.key}`"
            @click="copyFieldValue(field)"
          >
            コピー
          </EnButton>
        </div>
        <p
          class="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700"
          :class="field.type === 'textarea' ? 'line-clamp-6' : ''"
        >
          {{ displayValue(field) }}
        </p>
      </li>
    </ul>

    <ConsultationSourceCarousel
      v-if="hasReferenceSources"
      class="w-full pt-1"
      :source-references="resolvedSourceReferences"
      :grounding-metadata="groundingMetadata"
      :documents="referenceDocuments"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, toRef } from "vue";
import EnBadge from "@components/EnBadge.vue";
import EnButton from "@components/EnButton.vue";
import ConsultationSourceCarousel from "@components/ConsultationSourceCarousel.vue";
import { useWritingFilledDisplay } from "@composables/useWritingFilledDisplay";
import type { AgentSseArtifact } from "@composables/useAgentSseClient";
import type { Document } from "@models/document";
import type { WritingFieldType, WritingFormField } from "@models/writingForm";
import {
  messageHasReferenceSources,
  resolveMessageSourceReferences,
} from "@utils/adkArtifacts";
import type { ConsultationSourceReference } from "@utils/consultationSourceReferences";
import {
  buildWritingFieldsCsv,
  downloadWritingFieldsCsv,
} from "@utils/writingCsvExport";
import { findLatestWritingJsonArtifact } from "@utils/writingWorkspaceState";

const props = withDefaults(
  defineProps<{
    fields: WritingFormField[];
    messages: ReadonlyArray<{
      role: string;
      artifacts?: AgentSseArtifact[];
    }>;
    sourceReferences?: ConsultationSourceReference[] | null;
    groundingMetadata?: unknown;
    referenceDocuments?: Document[];
  }>(),
  {
    sourceReferences: undefined,
    groundingMetadata: undefined,
    referenceDocuments: () => [],
  }
);

const toast = useToast();
const messagesRef = toRef(props, "messages");

const { displayFields, loading } = useWritingFilledDisplay({
  fields: toRef(props, "fields"),
  messages: messagesRef,
});

const jsonArtifact = computed(() =>
  findLatestWritingJsonArtifact({ messages: props.messages })
);

const resolvedSourceReferences = computed(() =>
  resolveMessageSourceReferences({
    artifacts: jsonArtifact.value ? [jsonArtifact.value] : [],
    sourceReferences: props.sourceReferences,
    groundingMetadata: props.groundingMetadata,
  })
);

const hasReferenceSources = computed(() =>
  messageHasReferenceSources({
    artifacts: jsonArtifact.value ? [jsonArtifact.value] : [],
    sourceReferences: props.sourceReferences,
    groundingMetadata: props.groundingMetadata,
  })
);

const lengthLabel = (type: WritingFieldType): string => {
  switch (type) {
    case "textarea":
      return "長文";
    case "select":
      return "選択";
    case "date":
      return "日付";
    case "number":
      return "数値";
    default:
      return "短文";
  }
};

const displayValue = (field: WritingFormField): string => {
  const raw = (field.value ?? "").trim();
  return raw || "（未入力）";
};

const copyText = async (text: string): Promise<void> => {
  if (!text.trim()) return;
  try {
    await navigator.clipboard.writeText(text);
    toast.add({ title: "コピーしました", color: "success" });
  } catch {
    toast.add({ title: "コピーに失敗しました", color: "error" });
  }
};

const copyFieldValue = (field: WritingFormField): void => {
  const raw = (field.value ?? "").trim();
  if (!raw) {
    toast.add({ title: "コピーする値がありません", color: "warning" });
    return;
  }
  void copyText(raw);
};

const onCopyCsv = (): void => {
  const csv = buildWritingFieldsCsv({ fields: displayFields.value });
  void copyText(csv);
};

const onDownloadCsv = (): void => {
  downloadWritingFieldsCsv({ fields: displayFields.value });
  toast.add({ title: "CSV をダウンロードしました", color: "success" });
};
</script>
