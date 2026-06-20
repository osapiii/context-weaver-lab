<template>
  <section class="rounded-lg border border-slate-200 bg-white">
    <template v-if="application">
      <div class="border-b border-slate-100 p-5">
        <div class="flex flex-wrap items-start justify-between gap-4">
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
            <h2 class="mt-2 text-xl font-bold tracking-tight text-slate-950">
              {{ application.name }}
            </h2>
            <p class="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
              {{ application.summary || "このアプリケーションの概要はまだ登録されていません。" }}
            </p>
          </div>

          <div class="flex shrink-0 flex-wrap gap-2">
            <EnButton
              variant="outline"
              color="neutral"
              size="sm"
              leading-icon="material-symbols:edit-outline"
              @click="$emit('edit')"
            >
              編集
            </EnButton>
            <EnButton
              variant="soft"
              color="error"
              size="sm"
              leading-icon="material-symbols:delete-outline"
              :disabled="deleteDisabled"
              @click="$emit('delete')"
            >
              削除
            </EnButton>
          </div>
        </div>
      </div>

      <div class="grid gap-4 p-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
        <div class="grid gap-3 sm:grid-cols-2">
          <div
            v-for="item in metadata"
            :key="item.label"
            class="rounded-lg border border-slate-200 bg-slate-50 p-3"
          >
            <p class="text-xs font-medium text-slate-500">{{ item.label }}</p>
            <p class="mt-1 truncate text-sm font-semibold text-slate-900">
              {{ item.value || "未設定" }}
            </p>
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <div
            v-for="metric in metrics"
            :key="metric.label"
            class="rounded-lg border border-slate-200 p-3"
          >
            <div class="flex items-center justify-between gap-2">
              <p class="text-xs font-medium text-slate-500">{{ metric.label }}</p>
              <UIcon :name="metric.icon" class="h-4 w-4 text-slate-400" />
            </div>
            <p class="mt-2 text-2xl font-bold tabular-nums text-slate-950">
              {{ metric.value }}
            </p>
            <p class="mt-1 text-xs text-slate-500">{{ metric.caption }}</p>
          </div>
        </div>
      </div>

    </template>

    <div v-else class="p-8 text-center">
      <UIcon
        name="material-symbols:apps-outline"
        class="mx-auto h-8 w-8 text-slate-300"
      />
      <p class="mt-3 text-sm font-semibold text-slate-800">
        アプリケーションが未登録です
      </p>
      <p class="mt-1 text-xs text-slate-500">
        新規登録から、ユーザーストーリーを束ねるアプリケーションを作成してください。
      </p>
      <EnButton
        class="mt-4"
        variant="ai"
        size="sm"
        leading-icon="material-symbols:add"
        @click="$emit('create')"
      >
        アプリを登録
      </EnButton>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { DecodedVibeControlApplication } from "@models/vibeControl";

const props = defineProps<{
  application: DecodedVibeControlApplication | null;
  storyCount: number;
  averageConfidence: number;
  needsReviewCount: number;
  highDriftCount: number;
  deleteDisabled?: boolean;
}>();

defineEmits<{
  create: [];
  edit: [];
  delete: [];
}>();

const metadata = computed(() => [
  { label: "Domain", value: props.application?.domain },
  { label: "Owner", value: props.application?.owner },
  { label: "FileSpace", value: props.application?.fileSpaceId },
  { label: "Repository", value: props.application?.repoFullName },
  { label: "Default branch", value: props.application?.defaultBranch },
  { label: "Last generated", value: formatDate(props.application?.lastGeneratedAt) },
]);

const metrics = computed(() => [
  {
    label: "Stories",
    value: props.storyCount,
    caption: "このアプリ配下",
    icon: "material-symbols:article-outline",
  },
  {
    label: "Avg confidence",
    value: `${props.averageConfidence}%`,
    caption: "根拠・AC・コード対応",
    icon: "material-symbols:verified-outline",
  },
  {
    label: "Needs review",
    value: props.needsReviewCount,
    caption: "確認待ち",
    icon: "material-symbols:rate-review-outline",
  },
  {
    label: "High drift",
    value: props.highDriftCount,
    caption: "高リスク差分",
    icon: "material-symbols:warning-outline",
  },
]);

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
