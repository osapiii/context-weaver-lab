<template>
  <section class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
    <div class="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
      <p class="text-sm font-bold text-slate-950">
        整理の相談
      </p>
      <EnBadge color="neutral" variant="soft">Firebase AI</EnBadge>
    </div>

    <div class="grid gap-4 p-4">
      <div class="space-y-3">
        <div class="flex flex-wrap gap-2">
          <button
            v-for="suggestion in suggestions"
            :key="suggestion"
            type="button"
            class="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-950"
            @click="draft = suggestion"
          >
            {{ suggestion }}
          </button>
        </div>

        <form class="flex gap-2" @submit.prevent="generatePlan">
          <input
            v-model="draft"
            type="text"
            class="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            placeholder="例: 機能別にグループを作って動画を整理して"
            :disabled="isGenerating || isApplying"
          >
          <EnButton
            variant="ai"
            size="sm"
            leading-icon="material-symbols:auto-awesome-outline"
            :loading="isGenerating"
            :global-loading="false"
            :disabled="!draft.trim() || videos.length === 0"
            type="submit"
          >
            整理案を作成
          </EnButton>
        </form>

        <EnAlert
          v-if="errorMessage"
          color="warning"
          :title="errorMessage"
        />

        <div
          v-if="isGenerating"
          class="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500"
        >
          動画タイトル、説明、解析メモ、既存グループを見ながら整理案を作っています。
        </div>

        <div
          v-else-if="!plan"
          class="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-500"
        >
          相談すると、AIが新しい動画グループ案と移動対象をまとめます。適用前に内容を確認できます。
        </div>

        <div v-else class="space-y-3">
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p class="text-sm font-bold text-slate-950">{{ plan.summary }}</p>
            <p class="mt-1 text-xs text-slate-500">
              {{ plan.groups.length }}グループ / {{ plannedVideoCount }}件を整理対象にしています
            </p>
          </div>

          <article
            v-for="group in plan.groups"
            :key="groupKey(group)"
            class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-xs font-bold text-slate-500">
                  {{ group.existingGroupId ? "既存グループへ移動" : "新規グループを作成" }}
                </p>
                <h4 class="mt-1 text-sm font-bold text-slate-950">{{ group.name }}</h4>
                <p class="mt-1 text-xs leading-5 text-slate-600">
                  {{ group.description || "説明なし" }}
                </p>
              </div>
              <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                {{ group.videoIds.length }}件
              </span>
            </div>
            <p v-if="group.reason" class="mt-3 text-xs leading-5 text-slate-500">
              {{ group.reason }}
            </p>
            <div class="mt-3 flex flex-wrap gap-2">
              <span
                v-for="videoId in group.videoIds"
                :key="videoId"
                class="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700"
              >
                {{ videoLabel(videoId) }}
              </span>
            </div>
          </article>

          <div class="flex justify-end gap-2">
            <EnButton
              variant="outline"
              color="neutral"
              size="sm"
              :disabled="isApplying"
              @click="plan = null"
            >
              破棄
            </EnButton>
            <EnButton
              variant="ai"
              size="sm"
              leading-icon="material-symbols:check-circle-outline"
              :loading="isApplying"
              :global-loading="false"
              :disabled="plan.groups.length === 0"
              @click="applyPlan"
            >
              整理案を適用
            </EnButton>
          </div>
        </div>
      </div>

      <aside class="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h4 class="text-sm font-bold text-slate-950">現在の整理状況</h4>
        <dl class="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div class="rounded-md bg-white p-3">
            <dt class="font-semibold text-slate-500">動画</dt>
            <dd class="mt-1 text-lg font-bold text-slate-950">{{ videos.length }}</dd>
          </div>
          <div class="rounded-md bg-white p-3">
            <dt class="font-semibold text-slate-500">グループ</dt>
            <dd class="mt-1 text-lg font-bold text-slate-950">{{ groups.length }}</dd>
          </div>
        </dl>
        <div class="mt-4 space-y-2">
          <div
            v-for="group in groups"
            :key="group.id"
            class="rounded-md bg-white p-3"
          >
            <div class="flex items-center justify-between gap-2">
              <p class="truncate text-xs font-bold text-slate-800">{{ group.name }}</p>
              <span class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                {{ countByGroup[group.id] ?? 0 }}件
              </span>
            </div>
            <p class="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-500">
              {{ group.description || "説明なし" }}
            </p>
          </div>
        </div>
      </aside>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type {
  DecodedStoryVaultApplication,
  DecodedStoryVaultOperationVideo,
  DecodedStoryVaultOperationVideoGroup,
} from "@models/storyVault";

export type OperationVideoGroupAssistantPlanGroup = {
  existingGroupId?: string;
  name: string;
  description?: string;
  videoIds: string[];
  reason?: string;
};

export type OperationVideoGroupAssistantPlan = {
  summary: string;
  groups: OperationVideoGroupAssistantPlanGroup[];
};

export type OperationVideoGroupAssistantApplyCallbacks = {
  onSuccess?: () => void;
  onError?: (message: string) => void;
  onFinally?: () => void;
};

const props = defineProps<{
  application: DecodedStoryVaultApplication | null;
  videos: DecodedStoryVaultOperationVideo[];
  groups: DecodedStoryVaultOperationVideoGroup[];
  isApplying?: boolean;
}>();

const emit = defineEmits<{
  apply: [
    plan: OperationVideoGroupAssistantPlan,
    callbacks?: OperationVideoGroupAssistantApplyCallbacks,
  ];
}>();

const suggestions = [
  "機能や目的ごとにグループを作って整理して",
  "既存の操作動画を内容別に分けて",
  "似ている動画をまとめて、必要なら新しいグループも作って",
];

const draft = ref("");
const isGenerating = ref(false);
const errorMessage = ref("");
const plan = ref<OperationVideoGroupAssistantPlan | null>(null);

const countByGroup = computed<Record<string, number>>(() => {
  const counts: Record<string, number> = {};
  for (const video of props.videos) {
    if (!video.groupId) continue;
    counts[video.groupId] = (counts[video.groupId] ?? 0) + 1;
  }
  return counts;
});

const plannedVideoCount = computed(() => {
  const ids = new Set<string>();
  for (const group of plan.value?.groups ?? []) {
    for (const videoId of group.videoIds) ids.add(videoId);
  }
  return ids.size;
});

function groupKey(group: OperationVideoGroupAssistantPlanGroup): string {
  return `${group.existingGroupId || group.name}:${group.videoIds.join(",")}`;
}

function videoLabel(videoId: string): string {
  const index = props.videos.findIndex((video) => video.id === videoId);
  const video = props.videos[index];
  const displayId = index >= 0 ? `VID${index + 1}` : videoId;
  return video?.title ? `${displayId} ${video.title}` : displayId;
}

async function generatePlan(): Promise<void> {
  const instruction = draft.value.trim();
  if (!instruction || isGenerating.value) return;
  if (!props.application) {
    errorMessage.value = "対象アプリが選択されていません";
    return;
  }
  errorMessage.value = "";
  isGenerating.value = true;
  try {
    plan.value = await askFirebaseAiForPlan(instruction);
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "整理案の作成に失敗しました";
  } finally {
    isGenerating.value = false;
  }
}

function applyPlan(): void {
  if (!plan.value) return;
  errorMessage.value = "";
  emit("apply", plan.value, {
    onSuccess: () => {
      plan.value = null;
      draft.value = "";
    },
    onError: (message) => {
      errorMessage.value = message;
    },
  });
}

async function askFirebaseAiForPlan(instruction: string): Promise<OperationVideoGroupAssistantPlan> {
  const [{ getApp }, { getAI, getGenerativeModel, VertexAIBackend }] =
    await Promise.all([import("firebase/app"), import("firebase/ai")]);
  const ai = getAI(getApp(), { backend: new VertexAIBackend("us-central1") });
  const model = getGenerativeModel(ai, {
    model: "gemini-2.5-flash-lite",
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2400,
      responseMimeType: "application/json",
    },
  });
  const result = await model.generateContent([
    [
      "あなたはStoryVaultの操作動画整理アシスタントです。",
      "ユーザーの指示に従って、操作動画を動画グループへ整理する実行計画をJSONだけで返してください。",
      "既存グループを使う場合は existingGroupId を入れてください。",
      "新規グループが必要な場合は existingGroupId を省略し、短い日本語の name と description を入れてください。",
      "videoIds には必ず入力に存在する video.id だけを入れてください。",
      "同じ videoId を複数グループに入れないでください。",
      "判断できない動画は無理に含めないでください。",
      "",
      "返却形式:",
      JSON.stringify({
        summary: "整理方針の短い説明",
        groups: [
          {
            existingGroupId: "既存グループID。新規なら省略",
            name: "グループ名",
            description: "グループ説明",
            videoIds: ["operation-video-id"],
            reason: "このグループにした理由",
          },
        ],
      }),
      "",
      "## User instruction",
      instruction,
      "",
      "## Application",
      JSON.stringify({
        id: props.application?.id,
        name: props.application?.name,
        applicationKey: props.application?.applicationKey,
      }),
      "",
      "## Existing groups",
      JSON.stringify(
        props.groups.map((group) => ({
          id: group.id,
          name: group.name,
          description: group.description,
          videoCount: countByGroup.value[group.id] ?? 0,
        }))
      ),
      "",
      "## Videos",
      JSON.stringify(
        props.videos.map((video, index) => ({
          displayId: `VID${index + 1}`,
          id: video.id,
          title: video.title,
          description: video.description,
          groupId: video.groupId,
          groupNameSnapshot: video.groupNameSnapshot,
          transcriptSummary: video.transcriptSummary,
          quickScan: video.quickScan,
          storyCandidates: (video.analysisResult?.storyCandidates ?? []).slice(0, 5).map((story) => ({
            title: story.title,
            userRole: story.role?.value || story.asA,
            goal: story.goal,
            benefit: story.benefit,
          })),
        }))
      ).slice(0, 50000),
    ].join("\n"),
  ]);
  return normalizePlan(JSON.parse(result.response.text()));
}

function normalizePlan(raw: unknown): OperationVideoGroupAssistantPlan {
  const source = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const validVideoIds = new Set(props.videos.map((video) => video.id));
  const validGroupIds = new Set(props.groups.map((group) => group.id));
  const usedVideoIds = new Set<string>();
  const groups = Array.isArray(source.groups) ? source.groups : [];
  const normalizedGroups: OperationVideoGroupAssistantPlanGroup[] = [];
  for (const item of groups) {
    if (!item || typeof item !== "object") continue;
    const group = item as Record<string, unknown>;
    const name = typeof group.name === "string" ? group.name.trim() : "";
    const existingGroupId =
      typeof group.existingGroupId === "string" && validGroupIds.has(group.existingGroupId)
        ? group.existingGroupId
        : undefined;
    if (!name && !existingGroupId) continue;
    const videoIds = Array.isArray(group.videoIds)
      ? group.videoIds.filter((videoId): videoId is string => {
          if (typeof videoId !== "string") return false;
          if (!validVideoIds.has(videoId) || usedVideoIds.has(videoId)) return false;
          usedVideoIds.add(videoId);
          return true;
        })
      : [];
    if (videoIds.length === 0) continue;
    const existingGroup = existingGroupId
      ? props.groups.find((candidate) => candidate.id === existingGroupId)
      : null;
    normalizedGroups.push({
      existingGroupId,
      name: name || existingGroup?.name || "新しい動画グループ",
      description:
        typeof group.description === "string" ? group.description.trim() : existingGroup?.description,
      videoIds,
      reason: typeof group.reason === "string" ? group.reason.trim() : undefined,
    });
  }
  if (normalizedGroups.length === 0) {
    throw new Error("適用できる整理案が見つかりませんでした。もう少し具体的に指示してください。");
  }
  return {
    summary:
      typeof source.summary === "string" && source.summary.trim()
        ? source.summary.trim()
        : "動画グループの整理案を作成しました。",
    groups: normalizedGroups,
  };
}
</script>
