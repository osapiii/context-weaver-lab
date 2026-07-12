<template>
  <section class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-lg font-bold tracking-tight text-slate-950">
          アプリ一覧
        </h2>
        <p class="mt-1 text-sm text-slate-500">
          ユーザーストーリーSSOTを管理するアプリ単位を選択します
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <EnButton
          variant="outline"
          color="neutral"
          size="sm"
          leading-icon="i-simple-icons-github"
          @click="$emit('open-repositories')"
        >
          Repository一覧
        </EnButton>
        <EnButton
          variant="ai"
          size="sm"
          leading-icon="material-symbols:add"
          @click="$emit('create')"
        >
          アプリを追加
        </EnButton>
      </div>
    </div>

    <div
      v-if="applications.length > 0"
      class="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3"
    >
      <article
        v-for="application in applications"
        :key="application.id"
        class="flex min-w-0 flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-primary-200 hover:shadow-md"
      >
        <div class="flex min-w-0 items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <EnBadge variant="soft" color="neutral">
                {{ application.applicationKey }}
              </EnBadge>
              <EnBadge
                v-for="label in application.labels"
                :key="label"
                variant="tag"
                size="xs"
              >
                {{ label }}
              </EnBadge>
            </div>
            <h3 class="mt-2 truncate text-base font-bold text-slate-950">
              {{ application.name }}
            </h3>
            <p class="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600">
              {{ application.summary || "概要はまだ登録されていません。" }}
            </p>
          </div>
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
            <UIcon name="material-symbols:apps" class="h-5 w-5" />
          </div>
        </div>

        <div class="mt-4 grid grid-cols-2 gap-2">
          <div
            v-for="metric in metricsFor(application.id)"
            :key="metric.label"
            class="rounded-lg border border-slate-200 bg-slate-50 p-3"
          >
            <p class="text-xs font-medium text-slate-500">
              {{ metric.label }}
            </p>
            <p class="mt-1 text-xl font-bold tabular-nums text-slate-950">
              {{ metric.value }}
            </p>
            <p class="mt-1 text-[11px] text-slate-500">
              {{ metric.caption }}
            </p>
          </div>
        </div>

        <div class="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <p class="truncate">
            FileSpace:
            <span class="font-semibold text-slate-700">
              {{ application.fileSpaceId || "未設定" }}
            </span>
          </p>
          <p class="truncate">
            Repository:
            <span class="font-semibold text-slate-700">
              {{ application.repoFullName || "未設定" }}
            </span>
          </p>
          <p class="truncate">
            Last generated:
            <span class="font-semibold text-slate-700">
              {{ formatDate(application.lastGeneratedAt) || "未生成" }}
            </span>
          </p>
        </div>

        <div class="mt-4 flex justify-end">
          <EnButton
            variant="outline"
            color="neutral"
            size="sm"
            trailing-icon="material-symbols:chevron-right-rounded"
            @click="$emit('open', application.id)"
          >
            詳細
          </EnButton>
        </div>
      </article>
    </div>

    <div
      v-else
      class="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center"
    >
      <UIcon
        name="material-symbols:apps-outline"
        class="mx-auto h-10 w-10 text-slate-300"
      />
      <p class="mt-3 text-sm font-semibold text-slate-800">
        アプリがまだありません
      </p>
      <p class="mt-1 text-xs text-slate-500">
        まずアプリを作成し、その配下にユーザーストーリーSSOTを生成します。
      </p>
      <EnButton
        class="mt-4"
        variant="ai"
        size="sm"
        leading-icon="material-symbols:add"
        @click="$emit('create')"
      >
        アプリを追加
      </EnButton>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { DecodedStoryVaultApplication } from "@models/storyVault";

export type StoryVaultApplicationStats = {
  storyCount: number;
  averageConfidence: number;
  needsReviewCount: number;
  highDriftCount: number;
};

const props = defineProps<{
  applications: DecodedStoryVaultApplication[];
  statsByApplicationId: Record<string, StoryVaultApplicationStats>;
}>();

defineEmits<{
  open: [applicationId: string];
  create: [];
  "open-repositories": [];
}>();

function metricsFor(applicationId: string) {
  const stats = props.statsByApplicationId[applicationId] ?? {
    storyCount: 0,
    averageConfidence: 0,
    needsReviewCount: 0,
    highDriftCount: 0,
  };
  return [
    {
      label: "Stories",
      value: stats.storyCount,
      caption: "配下ストーリー",
    },
    {
      label: "Avg confidence",
      value: `${stats.averageConfidence}%`,
      caption: "根拠充足",
    },
    {
      label: "Needs review",
      value: stats.needsReviewCount,
      caption: "確認待ち",
    },
    {
      label: "High drift",
      value: stats.highDriftCount,
      caption: "高リスク差分",
    },
  ];
}

function formatDate(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
</script>
