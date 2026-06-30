<template>
  <section class="overflow-hidden rounded-lg border border-slate-200 bg-white">
    <div class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
      <div class="min-w-0">
        <h2 class="text-sm font-bold text-slate-900">Capability Workbench</h2>
        <p class="mt-1 text-xs leading-relaxed text-slate-500">
          Vertex AI Search に入ったザッピング証跡と SourceAsset を参照して Capability 構造を解析します
        </p>
      </div>
      <div class="grid grid-cols-4 gap-2 text-right">
        <div
          v-for="metric in metrics"
          :key="metric.label"
          class="rounded-md border border-slate-100 bg-slate-50 px-3 py-2"
        >
          <p class="text-[10px] font-semibold uppercase text-slate-400">
            {{ metric.label }}
          </p>
          <p class="text-base font-bold tabular-nums text-slate-900">
            {{ metric.value }}
          </p>
        </div>
      </div>
    </div>

    <div class="grid gap-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
      <div class="min-w-0 border-b border-slate-100 p-4 lg:border-b-0 lg:border-r">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h3 class="text-xs font-bold uppercase text-slate-500">
              Capability Map
            </h3>
            <p class="mt-1 text-xs text-slate-400">
              現在の区切りと根拠量を確認できます
            </p>
          </div>
        </div>

        <div class="mt-3 space-y-2">
          <button
            v-for="capability in capabilities"
            :key="capability.id"
            type="button"
            class="w-full rounded-md border px-3 py-3 text-left transition"
            :class="
              selectedCapabilityId === capability.id
                ? 'border-emerald-300 bg-emerald-50'
                : 'border-slate-200 bg-white hover:border-slate-300'
            "
            @click="selectedCapabilityId = capability.id"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="truncate text-sm font-bold text-slate-900">
                    {{ capability.name }}
                  </span>
                  <EnBadge variant="tag" size="xs">
                    {{ capability.capabilityKey }}
                  </EnBadge>
                </div>
                <p class="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
                  {{ capability.summary }}
                </p>
              </div>
              <div class="grid shrink-0 grid-cols-2 gap-1 text-right">
                <span class="rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-slate-500">
                  {{ storyCountByCapability[capability.id] ?? 0 }} story
                </span>
                <span class="rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-slate-500">
                  {{ evidenceCountByCapability[capability.id] ?? 0 }} ev
                </span>
              </div>
            </div>
          </button>

          <div
            v-if="capabilities.length === 0"
            class="flex min-h-36 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-xs text-slate-400"
          >
            Capability構造はまだありません
          </div>
        </div>

        <div class="mt-4 border-t border-slate-100 pt-4">
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-xs font-bold uppercase text-slate-500">
              Evidence / SourceAsset
            </h3>
            <EnBadge variant="tag" size="xs">
              {{ sourceAssets.length }} assets
            </EnBadge>
          </div>
          <div class="mt-3 grid gap-2 md:grid-cols-2">
            <article
              v-for="asset in visibleSourceAssets"
              :key="asset.id"
              class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
            >
              <div class="flex items-start justify-between gap-2">
                <p class="line-clamp-1 text-xs font-bold text-slate-800">
                  {{ asset.title }}
                </p>
                <EnBadge variant="tag" size="xs">
                  {{ asset.sourceType }}
                </EnBadge>
              </div>
              <p class="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
                {{ asset.summary || asset.uri || asset.gcsPath || "summaryなし" }}
              </p>
            </article>
          </div>
        </div>
      </div>

      <div class="min-w-0 bg-slate-50/70 p-4">
        <div class="rounded-md border border-slate-200 bg-white">
          <div class="border-b border-slate-100 px-3 py-2.5">
            <h3 class="text-sm font-bold text-slate-900">Capability解析</h3>
            <p class="mt-1 text-xs text-slate-500">
              今回の解析で重視したい観点を追加できます
            </p>
          </div>
          <div class="space-y-3 p-3">
            <div class="rounded-md border border-primary-200 bg-primary-50/70 px-3 py-3">
              <div class="flex items-start gap-3">
                <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-primary-700 ring-1 ring-primary-100">
                  <UIcon name="material-symbols:database-search-outline-rounded" class="h-4 w-4" />
                </span>
                <div class="min-w-0">
                  <p class="text-xs font-bold text-slate-900">
                    ザッピング証跡を Search Store から参照
                  </p>
                  <p class="mt-1 text-xs leading-relaxed text-slate-600">
                    動画から抽出したスクリーンショット、Aqua Voice全文文字起こし、要約、操作ステップをFileSpaceへ取り込み、Capability境界の根拠にします。
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
              v-if="!canRunCapabilityStructuring"
              class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700"
            >
              SourceAsset / Evidence / Story のいずれかを取り込むと解析を開始できます。
            </p>
            <textarea
              v-model="agentInstruction"
              rows="5"
              class="w-full resize-none rounded-md border border-slate-200 px-3 py-2 text-sm leading-relaxed text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              placeholder="例: 管理者と一般ユーザーの境界を分けて、根拠が弱いStoryはneeds_reviewにしてください"
            />
            <div class="flex flex-wrap gap-2">
              <EnButton
                variant="ai"
                size="sm"
                leading-icon="material-symbols:account-tree-outline"
                :loading="isGenerating"
                :disabled="!canRunCapabilityStructuring"
                @click="emitCapabilityStructuring"
              >
                Capability解析
              </EnButton>
            </div>
          </div>
        </div>

        <div class="mt-4 rounded-md border border-slate-200 bg-white">
          <div class="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5">
            <h3 class="text-sm font-bold text-slate-900">Generation Sessions</h3>
            <EnBadge variant="tag" size="xs">
              {{ generationSessions.length }}
            </EnBadge>
          </div>
          <div class="max-h-72 overflow-y-auto p-2">
            <article
              v-for="session in visibleSessions"
              :key="session.id"
              class="rounded-md px-2 py-2"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <p class="truncate text-xs font-bold text-slate-900">
                    {{ session.phase }}
                  </p>
                  <p class="mt-0.5 line-clamp-2 text-xs text-slate-500">
                    {{ session.lastMessage || session.id }}
                  </p>
                </div>
                <EnBadge
                  :color="session.status === 'error' ? 'error' : session.status === 'waiting_user' ? 'success' : 'warning'"
                  variant="soft"
                  size="xs"
                >
                  {{ session.status }}
                </EnBadge>
              </div>
            </article>
            <div
              v-if="visibleSessions.length === 0"
              class="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-8 text-center text-xs text-slate-400"
            >
              実行履歴はまだありません
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type {
  DecodedVibeControlApplication,
  DecodedVibeControlCapability,
  DecodedVibeControlGenerationSession,
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
  generationSessions: DecodedVibeControlGenerationSession[];
  isGenerating: boolean;
}>();

const emit = defineEmits<{
  "structure-capabilities": [input: VibeControlGenerationInput];
}>();

const selectedCapabilityId = ref("all");
const agentInstruction = ref("");

const metrics = computed(() => [
  { label: "Cap", value: props.capabilities.length },
  { label: "Story", value: props.stories.length },
  { label: "Evidence", value: props.evidence.length },
  { label: "Asset", value: props.sourceAssets.length },
]);

const storyCountByCapability = computed<Record<string, number>>(() => {
  const counts: Record<string, number> = {};
  for (const story of props.stories) {
    if (!story.capabilityId) continue;
    counts[story.capabilityId] = (counts[story.capabilityId] ?? 0) + 1;
  }
  return counts;
});

const evidenceCountByCapability = computed<Record<string, number>>(() => {
  const counts: Record<string, number> = {};
  for (const item of props.evidence) {
    if (!item.capabilityId) continue;
    counts[item.capabilityId] = (counts[item.capabilityId] ?? 0) + 1;
  }
  return counts;
});

const visibleSourceAssets = computed(() => props.sourceAssets.slice(0, 8));
const visibleSessions = computed(() => props.generationSessions.slice(0, 8));
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
const canRunCapabilityStructuring = computed(
  () =>
    Boolean(props.application) &&
    (props.sourceAssets.length > 0 ||
      props.evidence.length > 0 ||
      props.stories.length > 0)
);

const baseInput = (): VibeControlGenerationInput | null => {
  const application = props.application;
  if (!application) return null;
  return {
    applicationId: application.id,
    applicationKey: application.applicationKey,
    applicationName: application.name,
    fileSpaceId: application.fileSpaceId || "",
    repoFullName: application.repoFullName,
    defaultBranch: application.defaultBranch || "main",
    prompt: agentInstruction.value.trim() || undefined,
  };
};

const emitCapabilityStructuring = () => {
  if (!canRunCapabilityStructuring.value) return;
  const input = baseInput();
  if (!input) return;
  emit("structure-capabilities", input);
};

</script>
