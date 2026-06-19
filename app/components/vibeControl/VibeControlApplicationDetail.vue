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

      <div class="border-t border-slate-100 p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <h3 class="text-base font-bold text-slate-950">GitHub repository</h3>
            <p class="mt-1 text-sm text-slate-500">
              選択中アプリに紐づく repository の状態とマージ済みPRを表示します。
            </p>
          </div>
          <EnButton
            variant="outline"
            color="neutral"
            size="sm"
            leading-icon="material-symbols:refresh"
            :loading="githubLoading"
            :disabled="!application?.repoFullName"
            @click="loadGitHubData"
          >
            GitHub再読込
          </EnButton>
        </div>

        <EnAlert
          v-if="githubError"
          class="mt-4"
          color="warning"
          :title="githubError"
        />

        <div
          v-if="repository"
          class="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_16rem]"
        >
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div class="flex flex-wrap items-center gap-2">
              <EnBadge :color="repository.private ? 'warning' : 'neutral'" size="xs">
                {{ repository.private ? "Private" : "Public" }}
              </EnBadge>
              <EnBadge variant="tag" size="xs">
                {{ repository.defaultBranch || "main" }}
              </EnBadge>
              <EnBadge v-if="repository.language" variant="tag" size="xs">
                {{ repository.language }}
              </EnBadge>
            </div>
            <a
              :href="repository.htmlUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="mt-3 inline-flex min-w-0 items-center gap-2 text-sm font-bold text-primary-700 hover:text-primary-800"
            >
              <span class="truncate">{{ repository.fullName }}</span>
              <UIcon name="material-symbols:open-in-new-rounded" class="h-4 w-4 shrink-0" />
            </a>
            <p class="mt-2 text-sm leading-relaxed text-slate-600">
              {{ repository.description || "説明は登録されていません。" }}
            </p>
          </div>

          <div class="grid grid-cols-3 gap-2 lg:grid-cols-1">
            <div
              v-for="stat in repositoryStats"
              :key="stat.label"
              class="rounded-lg border border-slate-200 p-3"
            >
              <p class="text-xs font-medium text-slate-500">{{ stat.label }}</p>
              <p class="mt-1 text-lg font-bold tabular-nums text-slate-950">
                {{ stat.value }}
              </p>
            </div>
          </div>
        </div>

        <div class="mt-5 rounded-lg border border-slate-200 bg-white">
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <div>
              <h3 class="text-sm font-bold text-slate-950">マージ済みPR</h3>
              <p class="mt-1 text-xs text-slate-500">最新30件をGitHubからLive取得します。</p>
            </div>
            <EnBadge size="xs" color="neutral">
              {{ mergedPullRequests.length }} 件
            </EnBadge>
          </div>

          <div
            v-if="githubLoading"
            class="p-6 text-center text-sm text-slate-500"
          >
            GitHubからPRを取得しています...
          </div>
          <div
            v-else-if="mergedPullRequests.length === 0"
            class="p-6 text-center text-sm text-slate-500"
          >
            表示できるマージ済みPRがありません。
          </div>
          <div v-else class="divide-y divide-slate-100">
            <a
              v-for="pr in mergedPullRequests"
              :key="pr.id"
              :href="pr.htmlUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="block p-4 transition hover:bg-slate-50"
            >
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold text-slate-950">
                    #{{ pr.number }} {{ pr.title }}
                  </p>
                  <p class="mt-1 text-xs text-slate-500">
                    {{ pr.author || "unknown" }} / {{ pr.baseBranch }} ← {{ pr.headBranch }} / merged {{ formatDate(pr.mergedAt) }}
                  </p>
                </div>
                <div class="shrink-0 text-right text-xs text-slate-500">
                  <p>{{ pr.changedFiles }} files</p>
                  <p>
                    <span class="text-emerald-600">+{{ pr.additions }}</span>
                    <span class="mx-1">/</span>
                    <span class="text-rose-600">-{{ pr.deletions }}</span>
                  </p>
                </div>
              </div>
              <div v-if="pr.labels.length > 0" class="mt-2 flex flex-wrap gap-1">
                <EnBadge
                  v-for="label in pr.labels"
                  :key="`${pr.id}-${label}`"
                  variant="tag"
                  size="xs"
                >
                  {{ label }}
                </EnBadge>
              </div>
            </a>
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
import type {
  GitHubMergedPullRequest,
  GitHubRepositorySummary,
} from "@composables/useGitHubOAuth";

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

const github = useGitHubOAuth();
const repository = ref<GitHubRepositorySummary | null>(null);
const mergedPullRequests = ref<GitHubMergedPullRequest[]>([]);
const githubLoading = ref(false);
const githubError = ref("");

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

const repositoryStats = computed(() => [
  { label: "Stars", value: repository.value?.stargazersCount ?? 0 },
  { label: "Forks", value: repository.value?.forksCount ?? 0 },
  { label: "Watchers", value: repository.value?.watchersCount ?? 0 },
  { label: "Updated", value: formatDate(repository.value?.updatedAt) || "-" },
]);

watch(
  () => props.application?.repoFullName,
  () => {
    void loadGitHubData();
  },
  { immediate: true }
);

async function loadGitHubData(): Promise<void> {
  const repoFullName = props.application?.repoFullName;
  repository.value = null;
  mergedPullRequests.value = [];
  githubError.value = "";
  if (!repoFullName) return;
  githubLoading.value = true;
  try {
    await github.refreshConnection();
    repository.value = await github.getRepository(repoFullName);
    mergedPullRequests.value = await github.listMergedPullRequests(repoFullName);
  } catch (error) {
    githubError.value =
      error instanceof Error
        ? error.message
        : "GitHub repository情報の取得に失敗しました";
  } finally {
    githubLoading.value = false;
  }
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
