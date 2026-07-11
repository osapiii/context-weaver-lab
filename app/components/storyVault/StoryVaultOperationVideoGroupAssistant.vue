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
            placeholder="例: 機能別にクリップグループを作って整理して"
            :disabled="isGenerating || isApplying"
          >
          <EnButton
            variant="ai"
            size="sm"
            leading-icon="material-symbols:auto-awesome-outline"
            :loading="isGenerating"
            :global-loading="false"
            :disabled="!draft.trim() || clipRecords.length === 0"
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
          クリップのタイトル、説明、解析メモ、既存グループを見ながら整理案を作っています。
        </div>

        <div
          v-else-if="!plan"
          class="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-500"
        >
          相談すると、AIが新しいクリップグループ案と移動対象をまとめます。適用前に内容を確認できます。
        </div>

        <div v-else class="space-y-3">
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p class="text-sm font-bold text-slate-950">{{ plan.summary }}</p>
            <p class="mt-1 text-xs text-slate-500">
              {{ plan.groups.length }}グループ / {{ plannedClipGroupCount }}件を整理対象にしています
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
                  {{ group.existingGroupId ? "既存クリップグループへ移動" : "新規クリップグループを作成" }}
                </p>
                <h4 class="mt-1 text-sm font-bold text-slate-950">{{ group.name }}</h4>
                <p class="mt-1 text-xs leading-5 text-slate-600">
                  {{ group.description || "説明なし" }}
                </p>
              </div>
              <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                {{ group.clipIds.length }}件
              </span>
            </div>
            <p v-if="group.reason" class="mt-3 text-xs leading-5 text-slate-500">
              {{ group.reason }}
            </p>
            <div class="mt-3 flex flex-wrap gap-2">
              <span
                v-for="clipId in group.clipIds"
                :key="clipId"
                class="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700"
              >
                {{ clipLabel(clipId) }}
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
            <dt class="font-semibold text-slate-500">整理対象</dt>
            <dd class="mt-1 text-lg font-bold text-slate-950">{{ clipRecords.length }}</dd>
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
  DecodedStoryVaultClip,
  DecodedStoryVaultClipGroup,
} from "@models/storyVault";

export type ClipGroupAssistantPlanGroup = {
  existingGroupId?: string;
  name: string;
  description?: string;
  clipIds: string[];
  reason?: string;
};

export type ClipGroupAssistantPlan = {
  summary: string;
  groups: ClipGroupAssistantPlanGroup[];
};

export type ClipGroupAssistantApplyCallbacks = {
  onSuccess?: () => void;
  onError?: (message: string) => void;
  onFinally?: () => void;
};

const props = defineProps<{
  application: DecodedStoryVaultApplication | null;
  clipRecords: DecodedStoryVaultClip[];
  groups: DecodedStoryVaultClipGroup[];
  isApplying?: boolean;
}>();

const emit = defineEmits<{
  apply: [
    plan: ClipGroupAssistantPlan,
    callbacks?: ClipGroupAssistantApplyCallbacks,
  ];
}>();

const suggestions = [
  "機能や目的ごとにクリップグループを作って整理して",
  "既存のクリップを内容別に分けて",
  "似ているクリップをまとめて、必要なら新しいグループも作って",
];

const draft = ref("");
const isGenerating = ref(false);
const errorMessage = ref("");
const plan = ref<ClipGroupAssistantPlan | null>(null);

const countByGroup = computed<Record<string, number>>(() => {
  const counts: Record<string, number> = {};
  for (const clip of props.clipRecords) {
    if (!clip.clipGroupId) continue;
    counts[clip.clipGroupId] = (counts[clip.clipGroupId] ?? 0) + 1;
  }
  return counts;
});

const plannedClipGroupCount = computed(() => {
  const ids = new Set<string>();
  for (const group of plan.value?.groups ?? []) {
    for (const clipId of group.clipIds) ids.add(clipId);
  }
  return ids.size;
});

function groupKey(group: ClipGroupAssistantPlanGroup): string {
  return `${group.existingGroupId || group.name}:${group.clipIds.join(",")}`;
}

function clipLabel(clipId: string): string {
  const index = props.clipRecords.findIndex((clip) => clip.id === clipId);
  const clip = props.clipRecords[index];
  const displayId = index >= 0 ? `Clip ${index + 1}` : clipId;
  return clip?.title ? `${displayId} ${clip.title}` : displayId;
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

async function askFirebaseAiForPlan(instruction: string): Promise<ClipGroupAssistantPlan> {
  const [{ getApp }, { getAI, getGenerativeModel, GoogleAIBackend }] =
    await Promise.all([import("firebase/app"), import("firebase/ai")]);
  const ai = getAI(getApp(), { backend: new GoogleAIBackend() });
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
      "あなたはStoryVaultのクリップグループ整理アシスタントです。",
      "ユーザーの指示に従って、クリップをクリップグループへ整理する実行計画をJSONだけで返してください。",
      "既存グループを使う場合は existingGroupId を入れてください。",
      "新規グループが必要な場合は existingGroupId を省略し、短い日本語の name と description を入れてください。",
      "clipIds には必ず入力に存在する clip.id だけを入れてください。",
      "同じ clipId を複数グループに入れないでください。",
      "判断できないクリップは無理に含めないでください。",
      "",
      "返却形式:",
      JSON.stringify({
        summary: "整理方針の短い説明",
        groups: [
          {
            existingGroupId: "既存グループID。新規なら省略",
            name: "グループ名",
            description: "グループ説明",
            clipIds: ["clip-id"],
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
          clipCount: countByGroup.value[group.id] ?? 0,
        }))
      ),
      "",
      "## Clips",
      JSON.stringify(
        props.clipRecords.map((clip, index) => ({
          displayId: `Clip ${index + 1}`,
          id: clip.id,
          title: clip.title,
          description: clip.description,
          clipGroupId: clip.clipGroupId,
          clipGroupNameSnapshot: clip.clipGroupNameSnapshot,
          transcriptSummary: clip.transcriptSummary,
          quickScan: clip.quickScan,
          storyCandidates: (clip.analysisResult?.storyCandidates ?? []).slice(0, 5).map((story) => ({
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

function normalizePlan(raw: unknown): ClipGroupAssistantPlan {
  const source = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const validClipIds = new Set(props.clipRecords.map((video) => video.id));
  const validGroupIds = new Set(props.groups.map((group) => group.id));
  const usedClipIds = new Set<string>();
  const groups = Array.isArray(source.groups) ? source.groups : [];
  const normalizedGroups: ClipGroupAssistantPlanGroup[] = [];
  for (const item of groups) {
    if (!item || typeof item !== "object") continue;
    const group = item as Record<string, unknown>;
    const name = typeof group.name === "string" ? group.name.trim() : "";
    const existingGroupId =
      typeof group.existingGroupId === "string" && validGroupIds.has(group.existingGroupId)
        ? group.existingGroupId
        : undefined;
    if (!name && !existingGroupId) continue;
    const rawClipIds = Array.isArray(group.clipIds) ? group.clipIds : [];
    const clipIds = rawClipIds
      .filter((clipId): clipId is string => {
        if (typeof clipId !== "string") return false;
        if (!validClipIds.has(clipId) || usedClipIds.has(clipId)) return false;
        usedClipIds.add(clipId);
        return true;
      });
    if (clipIds.length === 0) continue;
    const existingGroup = existingGroupId
      ? props.groups.find((candidate) => candidate.id === existingGroupId)
      : null;
    normalizedGroups.push({
      existingGroupId,
      name: name || existingGroup?.name || "新しいクリップグループ",
      description:
        typeof group.description === "string" ? group.description.trim() : existingGroup?.description,
      clipIds,
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
        : "クリップグループの整理案を作成しました。",
    groups: normalizedGroups,
  };
}
</script>
