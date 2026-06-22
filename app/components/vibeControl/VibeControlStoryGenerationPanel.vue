<template>
  <section class="overflow-hidden rounded-lg border border-slate-200 bg-white">
    <div class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
      <div class="min-w-0">
        <h2 class="text-sm font-bold text-slate-900">Story生成</h2>
        <p class="mt-1 text-xs leading-relaxed text-slate-500">
          Capability と根拠を選び、ユーザーストーリー生成Agentを起動します
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <EnBadge variant="tag" size="xs">
          {{ stories.length }} stories
        </EnBadge>
        <EnBadge variant="tag" size="xs">
          {{ capabilities.length }} capabilities
        </EnBadge>
      </div>
    </div>

    <div class="grid gap-4 p-4 lg:grid-cols-[minmax(18rem,0.75fr)_minmax(0,1.25fr)]">
      <div class="space-y-3">
        <label class="block">
          <span class="text-xs font-bold text-slate-500">Capability scope</span>
          <select
            v-model="selectedCapabilityId"
            class="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="all">すべてのCapability</option>
            <option
              v-for="capability in capabilities"
              :key="capability.id"
              :value="capability.id"
            >
              {{ capability.capabilityKey }} / {{ capability.name }}
            </option>
          </select>
        </label>

        <textarea
          v-model="agentInstruction"
          rows="5"
          class="w-full resize-none rounded-md border border-slate-200 px-3 py-2 text-sm leading-relaxed text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          placeholder="例: 画面操作で確認できたユーザー行動を優先して、Acceptance Criteriaも根拠付きで出してください"
        />

        <p
          v-if="!canRunStoryGeneration"
          class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700"
        >
          Capability と SourceAsset / Evidence の根拠を用意するとStory生成を開始できます。
        </p>

        <EnButton
          variant="ai"
          size="sm"
          leading-icon="material-symbols:format-list-bulleted-add"
          :loading="isGenerating"
          :disabled="!canRunStoryGeneration"
          @click="emitStoryGeneration"
        >
          Story生成
        </EnButton>
      </div>

      <div class="grid gap-3 md:grid-cols-3">
        <article
          v-for="metric in metrics"
          :key="metric.label"
          class="rounded-md border border-slate-200 bg-slate-50 px-3 py-3"
        >
          <p class="text-xs font-bold text-slate-500">{{ metric.label }}</p>
          <p class="mt-1 text-xl font-bold tabular-nums text-slate-950">
            {{ metric.value }}
          </p>
          <p class="mt-1 text-xs text-slate-500">{{ metric.caption }}</p>
        </article>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type {
  DecodedVibeControlApplication,
  DecodedVibeControlCapability,
  DecodedVibeControlSourceAsset,
  DecodedVibeControlStory,
  DecodedVibeControlStoryEvidence,
} from "@models/vibeControl";
import type { VibeControlGenerationInput } from "@stores/vibeControl";

const props = defineProps<{
  application: DecodedVibeControlApplication | null;
  capabilities: DecodedVibeControlCapability[];
  stories: DecodedVibeControlStory[];
  evidence: DecodedVibeControlStoryEvidence[];
  sourceAssets: DecodedVibeControlSourceAsset[];
  isGenerating: boolean;
}>();

const emit = defineEmits<{
  "generate-stories": [input: VibeControlGenerationInput];
}>();

const selectedCapabilityId = ref("all");
const agentInstruction = ref("");

const selectedCapability = computed(() =>
  selectedCapabilityId.value === "all"
    ? null
    : props.capabilities.find((item) => item.id === selectedCapabilityId.value) ??
      null
);

const scopedStories = computed(() =>
  selectedCapability.value
    ? props.stories.filter((story) => story.capabilityId === selectedCapability.value?.id)
    : props.stories
);

const scopedEvidence = computed(() =>
  selectedCapability.value
    ? props.evidence.filter(
        (item) => item.capabilityId === selectedCapability.value?.id
      )
    : props.evidence
);

const metrics = computed(() => [
  {
    label: "Scope Stories",
    value: scopedStories.value.length,
    caption: selectedCapability.value?.name ?? "全Capability対象",
  },
  {
    label: "Evidence",
    value: scopedEvidence.value.length,
    caption: "Story生成に使える根拠",
  },
  {
    label: "SourceAsset",
    value: props.sourceAssets.length,
    caption: "画面・動画・GitHub等",
  },
]);

const canRunStoryGeneration = computed(
  () =>
    Boolean(props.application) &&
    props.capabilities.length > 0 &&
    (props.sourceAssets.length > 0 || props.evidence.length > 0)
);

const emitStoryGeneration = () => {
  if (!canRunStoryGeneration.value) return;
  const application = props.application;
  if (!application) return;
  emit("generate-stories", {
    applicationId: application.id,
    applicationKey: application.applicationKey,
    applicationName: application.name,
    fileSpaceId: application.fileSpaceId || "",
    repoFullName: application.repoFullName,
    defaultBranch: application.defaultBranch || "main",
    capabilityId:
      selectedCapabilityId.value === "all" ? undefined : selectedCapabilityId.value,
    prompt: agentInstruction.value.trim() || undefined,
  });
};
</script>
