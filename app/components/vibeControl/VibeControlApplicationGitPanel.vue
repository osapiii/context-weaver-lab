<template>
  <section class="space-y-4">
    <div
      v-if="!application?.repoFullName"
      class="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center"
    >
      <UIcon
        name="i-simple-icons-github"
        class="mx-auto h-10 w-10 text-slate-300"
      />
      <p class="mt-3 text-sm font-semibold text-slate-800">
        GitHub repository が未設定です
      </p>
      <p class="mt-1 text-xs text-slate-500">
        Application は repository と1:1で紐づきます。編集から repository を選択してください。
      </p>
    </div>

    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="min-w-0">
          <h2 class="text-lg font-bold tracking-tight text-slate-950">Gitリポジトリ</h2>
          <p class="mt-1 text-sm text-slate-500">
            接続済みリポジトリの基本情報と直近のマージ済みPRを確認します
          </p>
        </div>
        <EnButton
          variant="outline"
          color="neutral"
          size="sm"
          leading-icon="material-symbols:refresh"
          :loading="githubLoading"
          @click="loadGitHubData"
        >
          再読込
        </EnButton>
      </div>

      <EnAlert
        v-if="githubError"
        color="warning"
        :title="githubError"
      />

      <div
        v-if="githubLoading && !repository"
        class="rounded-lg border border-slate-200 bg-white p-10 text-center text-sm text-slate-500"
      >
        GitHub repository を取得しています...
      </div>

      <div
        v-else-if="repository"
        class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
      >
        <div class="grid gap-0 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div class="border-b border-slate-100 p-5 lg:border-b-0 lg:border-r">
            <div class="flex flex-wrap items-center gap-2">
              <EnBadge :color="repository.private ? 'warning' : 'neutral'" size="xs">
                {{ repository.private ? "非公開" : "公開" }}
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
              class="mt-3 inline-flex min-w-0 items-center gap-2 text-base font-bold text-primary-700 hover:text-primary-800"
            >
              <UIcon name="i-simple-icons-github" class="h-4 w-4 shrink-0" />
              <span class="truncate">{{ repository.fullName }}</span>
              <UIcon name="material-symbols:open-in-new-rounded" class="h-4 w-4 shrink-0" />
            </a>

            <p class="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
              {{ repository.description || "説明は登録されていません。" }}
            </p>
          </div>

          <div class="grid grid-cols-2 gap-px bg-slate-100 lg:grid-cols-1">
            <div
              v-for="stat in repositoryStats"
              :key="stat.label"
              class="bg-white p-4"
            >
              <p class="text-xs font-semibold text-slate-500">{{ stat.label }}</p>
              <p class="mt-1 text-lg font-bold tabular-nums text-slate-950">
                {{ stat.value }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div>
            <h3 class="text-sm font-bold text-slate-950">マージ済みPR</h3>
              <p class="mt-1 text-xs text-slate-500">最新30件をGitHubから取得します</p>
          </div>
          <EnBadge size="xs" color="neutral">
            {{ mergedPullRequests.length }} 件
          </EnBadge>
        </div>

        <div
          v-if="githubLoading && mergedPullRequests.length === 0"
          class="p-8 text-center text-sm text-slate-500"
        >
          GitHubからPRを取得しています...
        </div>
        <div
          v-else-if="mergedPullRequests.length === 0"
          class="p-8 text-center text-sm text-slate-500"
        >
          表示できるマージ済みPRがありません。
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full min-w-[960px] text-sm">
            <thead class="bg-slate-50 text-xs tracking-wide text-slate-500">
              <tr>
                <th class="px-4 py-3 text-left font-bold">PR</th>
                <th class="px-4 py-3 text-left font-bold">作成者</th>
                <th class="px-4 py-3 text-left font-bold">ブランチ</th>
                <th class="px-4 py-3 text-left font-bold">マージ日時</th>
                <th class="px-4 py-3 text-right font-bold">差分</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="pr in mergedPullRequests"
                :key="pr.id"
                class="transition hover:bg-slate-50"
              >
                <td class="max-w-[28rem] px-4 py-3">
                  <a
                    :href="pr.htmlUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="font-semibold text-slate-950 hover:text-primary-700"
                  >
                    #{{ pr.number }} {{ pr.title }}
                  </a>
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
                </td>
                <td class="px-4 py-3 text-slate-600">
                  {{ pr.author || "unknown" }}
                </td>
                <td class="px-4 py-3 text-xs text-slate-500">
                  <span class="font-mono">{{ pr.baseBranch }}</span>
                  <span class="mx-1">←</span>
                  <span class="font-mono">{{ pr.headBranch }}</span>
                </td>
                <td class="px-4 py-3 text-xs text-slate-500">
                  {{ formatDate(pr.mergedAt) }}
                </td>
                <td class="px-4 py-3 text-right text-xs text-slate-500">
                  <template v-if="hasDiffStats(pr)">
                    <p>{{ pr.changedFiles }} files</p>
                    <p>
                      <span class="text-emerald-600">+{{ pr.additions }}</span>
                      <span class="mx-1">/</span>
                      <span class="text-rose-600">-{{ pr.deletions }}</span>
                    </p>
                  </template>
                  <span v-else class="text-slate-400">未取得</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
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
}>();

const github = useGitHubOAuth();
const repository = ref<GitHubRepositorySummary | null>(null);
const mergedPullRequests = ref<GitHubMergedPullRequest[]>([]);
const githubLoading = ref(false);
const githubError = ref("");

const repositoryStats = computed(() => [
  { label: "スター", value: repository.value?.stargazersCount ?? 0 },
  { label: "フォーク", value: repository.value?.forksCount ?? 0 },
  { label: "ウォッチ", value: repository.value?.watchersCount ?? 0 },
  { label: "更新日時", value: formatDate(repository.value?.updatedAt) || "-" },
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

function hasDiffStats(pr: GitHubMergedPullRequest): boolean {
  return (
    pr.changedFiles !== null &&
    pr.additions !== null &&
    pr.deletions !== null
  );
}
</script>
