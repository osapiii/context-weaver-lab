<template>
  <section class="overflow-hidden rounded-lg border border-slate-200 bg-white">
    <div class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
      <div class="min-w-0">
        <p class="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600">
          Next action
        </p>
        <h2 class="mt-1 text-base font-bold text-slate-900">
          ユーザーストーリーを作る
        </h2>
        <p class="mt-1 text-xs leading-relaxed text-slate-500">
          Search Store上のザッピング証跡を読み、機能単位に沿ってStory候補を生成します。
        </p>
      </div>
      <EnBadge
        :color="canRunStoryGeneration ? 'success' : 'warning'"
        variant="soft"
        size="xs"
      >
        {{ canRunStoryGeneration ? "生成できます" : "準備が必要" }}
      </EnBadge>
    </div>

    <div class="grid gap-4 p-4 xl:grid-cols-[minmax(18rem,0.85fr)_minmax(0,1.15fr)]">
      <div class="space-y-3">
        <div class="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
          <article
            v-for="item in readinessItems"
            :key="item.label"
            class="flex items-start gap-3 rounded-md border px-3 py-2.5"
            :class="item.ready ? 'border-emerald-200 bg-emerald-50/70' : 'border-amber-200 bg-amber-50/70'"
          >
            <span
              class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
              :class="item.ready ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'"
            >
              <UIcon :name="item.ready ? 'material-symbols:check-small-rounded' : 'material-symbols:priority-high-rounded'" class="h-4 w-4" />
            </span>
            <div class="min-w-0">
              <p class="text-xs font-bold text-slate-800">{{ item.label }}</p>
              <p class="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                {{ item.caption }}
              </p>
            </div>
          </article>
        </div>

        <label class="block">
          <span class="text-xs font-bold text-slate-500">対象機能</span>
          <select
            v-model="selectedCapabilityId"
            class="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="all">すべての機能</option>
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
          rows="3"
          class="w-full resize-none rounded-md border border-slate-200 px-3 py-2 text-sm leading-relaxed text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          placeholder="任意: 例) 録画で説明された利用意図を優先して、Acceptance Criteriaも根拠付きで出す"
        />

        <div class="rounded-md border border-primary-200 bg-primary-50/70 px-3 py-3">
          <div class="flex items-start gap-3">
            <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-primary-700 ring-1 ring-primary-100">
              <UIcon name="material-symbols:database-search-outline-rounded" class="h-4 w-4" />
            </span>
            <div class="min-w-0">
              <p class="text-xs font-bold text-slate-900">
                動画由来の根拠からStory化
              </p>
              <p class="mt-1 text-[11px] leading-relaxed text-slate-600">
                5秒ごとのスクリーンショット、Gemini全文文字起こし、要約、操作ステップをFileSpace/Vertex AI Searchで参照します。
              </p>
              <div class="mt-2 flex flex-wrap gap-1.5">
                <EnBadge variant="tag" size="xs">
                  Search {{ zappingSearchAssetCount }}
                </EnBadge>
                <EnBadge variant="tag" size="xs">
                  Video {{ zappingVideoAssetCount }}
                </EnBadge>
                <EnBadge variant="tag" size="xs">
                  Transcript {{ zappingTranscriptAssetCount }}
                </EnBadge>
              </div>
            </div>
          </div>
        </div>

        <p
          v-if="!canRunStoryGeneration"
          class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700"
        >
          機能と根拠素材を用意するとStory生成を開始できます。
        </p>

          <EnButton
            variant="ai"
            size="sm"
            leading-icon="material-symbols:format-list-bulleted-add"
            custom-class="w-full justify-center sm:w-auto"
            :loading="isGenerating"
            :disabled="!canRunStoryGeneration"
            @click="emitStoryGeneration"
          >
          Story候補を生成
          </EnButton>
      </div>

      <div class="grid content-start gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-2">
        <article
          v-for="metric in metrics"
          :key="metric.label"
          class="rounded-md border border-slate-200 bg-slate-50 px-3 py-3"
        >
          <p class="text-xs font-bold text-slate-500">{{ metric.label }}</p>
          <p class="mt-1 text-2xl font-bold tabular-nums text-slate-950">
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
  DecodedStoryVaultApplication,
  DecodedStoryVaultCapability,
  DecodedStoryVaultSourceAsset,
  DecodedStoryVaultStory,
  DecodedStoryVaultStoryEvidence,
} from "@models/storyVault";
import type { StoryVaultGenerationInput } from "@stores/storyVault";

const props = defineProps<{
  application: DecodedStoryVaultApplication | null;
  capabilities: DecodedStoryVaultCapability[];
  stories: DecodedStoryVaultStory[];
  evidence: DecodedStoryVaultStoryEvidence[];
  sourceAssets: DecodedStoryVaultSourceAsset[];
  isGenerating: boolean;
}>();

const emit = defineEmits<{
  "generate-stories": [input: StoryVaultGenerationInput];
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
    label: "機能",
    value: props.capabilities.length,
    caption: "Storyを束ねる機能単位",
  },
  {
    label: "Story",
    value: scopedStories.value.length,
    caption: selectedCapability.value?.name ?? "現在の登録数",
  },
  {
    label: "根拠",
    value: scopedEvidence.value.length,
    caption: "Story生成に使える根拠",
  },
  {
    label: "素材",
    value: props.sourceAssets.length,
    caption: "動画・画面・GitHub等",
  },
]);

const zappingAssets = computed(() =>
  props.sourceAssets.filter((asset) =>
    asset.sourceType.startsWith("operation_video")
  )
);

const zappingSearchAssetCount = computed(
  () =>
    zappingAssets.value.filter(
      (asset) =>
        asset.discoveryStatus === "queued" ||
        asset.discoveryStatus === "completed"
    ).length
);

const zappingVideoAssetCount = computed(
  () => zappingAssets.value.filter((asset) => asset.sourceType === "operation_video").length
);

const zappingTranscriptAssetCount = computed(
  () =>
    zappingAssets.value.filter(
      (asset) =>
        Boolean(asset.metadata?.transcriptText) ||
        Boolean(asset.metadata?.transcriptSummary)
    ).length
);

const readinessItems = computed(() => [
  {
    label: "機能",
    ready: props.capabilities.length > 0,
    caption:
      props.capabilities.length > 0
        ? `${props.capabilities.length}件あります`
        : "先に機能一覧を作成します",
  },
  {
    label: "根拠",
    ready: props.sourceAssets.length > 0 || props.evidence.length > 0,
    caption:
      props.sourceAssets.length > 0 || props.evidence.length > 0
        ? "Search Store上の動画証跡・画面・知識を参照できます"
        : "ザッピング動画やナレッジを追加します",
  },
  {
    label: "生成先",
    ready: Boolean(props.application),
    caption: props.application?.name ?? "アプリを選択してください",
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
