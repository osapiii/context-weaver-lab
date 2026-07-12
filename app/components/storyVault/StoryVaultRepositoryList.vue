<template>
  <section class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-lg font-bold tracking-tight text-slate-950">
          Gitリポジトリ
        </h2>
        <p class="mt-1 text-sm text-slate-500">
          GitHub の接続状態、PR参照元、アプリ設定との紐付けをまとめて確認します
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <EnButton
          variant="outline"
          color="neutral"
          size="sm"
          leading-icon="material-symbols:refresh"
          :loading="repositoriesLoading"
          :disabled="!connection.connected"
          @click="loadRepositories"
        >
          再読込
        </EnButton>
        <EnButton
          variant="outline"
          color="neutral"
          size="sm"
          leading-icon="i-simple-icons-github"
          :loading="github.isLoading.value || repositoriesLoading"
          @click="connectGitHub"
        >
          {{ connection.connected ? "接続を切り替え" : "GitHub接続" }}
        </EnButton>
      </div>
    </div>

    <div
      v-if="!connection.connected"
      class="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center"
    >
      <UIcon
        name="i-simple-icons-github"
        class="mx-auto h-10 w-10 text-slate-300"
      />
      <p class="mt-3 text-sm font-semibold text-slate-800">
        GitHub が未接続です
      </p>
      <p class="mt-1 text-xs text-slate-500">
        PR一覧や private repository を確認するには GitHub OAuth 接続が必要です。
      </p>
      <EnButton
        class="mt-4"
        variant="ai"
        size="sm"
        leading-icon="i-simple-icons-github"
        :loading="github.isLoading.value || repositoriesLoading"
        @click="connectGitHub"
      >
        GitHub接続
      </EnButton>
    </div>

    <div
      v-else
      class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
    >
      <div class="border-b border-slate-100 bg-slate-50/60 p-4">
        <div class="grid gap-3 md:grid-cols-3">
          <div
            v-for="item in repositoryOverview"
            :key="item.label"
            class="rounded-lg border border-slate-200 bg-white p-4"
          >
            <div class="flex items-center gap-2">
              <span
                class="inline-flex h-8 w-8 items-center justify-center rounded-lg"
                :class="item.iconClass"
              >
                <UIcon :name="item.icon" class="h-4 w-4" />
              </span>
              <p class="text-xs font-bold text-slate-500">
                {{ item.label }}
              </p>
            </div>
            <p class="mt-3 truncate text-lg font-black text-slate-950">
              {{ item.value }}
            </p>
            <p class="mt-1 truncate text-xs text-slate-500">
              {{ item.description }}
            </p>
          </div>
        </div>

        <label class="mt-4 block">
          <span class="text-xs font-semibold text-slate-500">リポジトリ検索</span>
          <div class="mt-1 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100">
            <UIcon name="material-symbols:search" class="h-4 w-4 text-slate-400" />
            <input
              v-model="searchQuery"
              type="search"
              class="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none"
              placeholder="enostech / リポジトリ名 / 言語で検索"
            >
          </div>
        </label>

        <div class="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
          <p class="font-semibold text-slate-700">
            {{ repositories.length }}件中 {{ filteredRepositories.length }}件を表示
          </p>
          <p class="flex items-center gap-2 text-slate-600">
            <span>GitHub: {{ connection.login || "GitHub" }}</span>
            <EnBadge color="success" size="xs">接続済み</EnBadge>
          </p>
        </div>
      </div>

      <EnAlert
        v-if="errorMessage"
        class="m-4"
        color="warning"
        :title="errorMessage"
      />

      <div
        v-if="repositoriesLoading"
        class="p-8 text-center text-sm text-slate-500"
      >
        GitHub repository を取得しています...
      </div>
      <div
        v-else-if="filteredRepositories.length === 0"
        class="p-8 text-center text-sm text-slate-500"
      >
        表示できる repository がありません。
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[880px] text-sm">
          <thead class="bg-slate-50 text-xs tracking-wide text-slate-500">
            <tr>
              <th class="px-4 py-3 text-left font-bold">リポジトリ</th>
              <th class="px-4 py-3 text-left font-bold">既定ブランチ</th>
              <th class="px-4 py-3 text-left font-bold">言語</th>
              <th class="px-4 py-3 text-left font-bold">公開範囲</th>
              <th class="px-4 py-3 text-left font-bold">更新日時</th>
              <th class="px-4 py-3 text-right font-bold">App設定</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="repository in filteredRepositories"
              :key="repository.fullName"
              class="cursor-pointer transition hover:bg-slate-50"
              @click="openRepository(repository)"
            >
              <td class="px-4 py-3">
                <div class="flex min-w-0 items-center gap-2">
                  <UIcon name="i-simple-icons-github" class="h-4 w-4 shrink-0 text-slate-700" />
                  <div class="min-w-0">
                    <p class="truncate font-semibold text-slate-900">
                      github.com/{{ repository.fullName }}
                    </p>
                    <p class="truncate text-xs text-slate-500">
                      {{ repository.description || "説明なし" }}
                    </p>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3 font-mono text-xs font-semibold text-slate-600">
                {{ repository.defaultBranch || "main" }}
              </td>
              <td class="px-4 py-3 text-slate-600">
                {{ repository.language || "-" }}
              </td>
              <td class="px-4 py-3">
                <EnBadge :color="repository.private ? 'warning' : 'neutral'" size="xs">
                  {{ repository.private ? "非公開" : "公開" }}
                </EnBadge>
              </td>
              <td class="px-4 py-3 text-xs text-slate-500">
                {{ formatDate(repository.updatedAt) || "-" }}
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center justify-end gap-2">
                  <EnBadge
                    :color="applicationFor(repository) ? 'success' : 'neutral'"
                    size="xs"
                  >
                    {{ applicationFor(repository) ? "設定済み" : "未設定" }}
                  </EnBadge>
                  <EnButton
                    v-if="applicationFor(repository)"
                    variant="outline"
                    color="neutral"
                    size="xs"
                    @click.stop="openApplication(applicationFor(repository)!.id)"
                  >
                    アプリ詳細
                  </EnButton>
                  <EnButton
                    v-else
                    variant="outline"
                    color="neutral"
                    size="xs"
                    @click.stop="$emit('configure-repository', repository)"
                  >
                    アプリ設定
                  </EnButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <USlideover
      v-model:open="repositoryDetailOpen"
      side="right"
      :ui="{ content: 'w-full sm:max-w-[560px]' }"
    >
      <template #content>
        <div v-if="selectedRepository" class="flex h-full flex-col bg-white">
          <div class="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
            <div class="min-w-0">
              <p class="text-xs font-bold tracking-wide text-slate-500">
                リポジトリ詳細
              </p>
              <h3 class="mt-1 truncate text-lg font-bold text-slate-950">
                {{ selectedRepository.fullName }}
              </h3>
            </div>
            <button
              type="button"
              class="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              @click="repositoryDetailOpen = false"
            >
              <UIcon name="material-symbols:close-rounded" class="h-5 w-5" />
            </button>
          </div>

          <div class="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
            <div class="space-y-3">
              <div class="flex flex-wrap items-center gap-2">
                <EnBadge :color="selectedRepository.private ? 'warning' : 'neutral'" size="xs">
                  {{ selectedRepository.private ? "非公開" : "公開" }}
                </EnBadge>
                <EnBadge variant="tag" size="xs">
                  {{ selectedRepository.defaultBranch || "main" }}
                </EnBadge>
                <EnBadge v-if="selectedRepository.language" variant="tag" size="xs">
                  {{ selectedRepository.language }}
                </EnBadge>
              </div>
              <p class="text-sm leading-relaxed text-slate-600">
                {{ selectedRepository.description || "説明は登録されていません。" }}
              </p>
              <a
                :href="selectedRepository.htmlUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 text-sm font-bold text-primary-700 hover:text-primary-800"
              >
                GitHubで開く
                <UIcon name="material-symbols:open-in-new-rounded" class="h-4 w-4" />
              </a>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div
                v-for="stat in repositoryStats"
                :key="stat.label"
                class="rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <p class="text-xs font-semibold text-slate-500">{{ stat.label }}</p>
                <p class="mt-1 text-lg font-bold tabular-nums text-slate-950">
                  {{ stat.value }}
                </p>
              </div>
            </div>

            <div class="rounded-lg border border-slate-200 p-4">
              <div class="flex items-center justify-between gap-2">
                <h4 class="text-sm font-bold text-slate-950">Application設定</h4>
                <EnBadge
                  :color="selectedApplication ? 'success' : 'neutral'"
                  size="xs"
                >
                  {{ selectedApplication ? "設定済み" : "未設定" }}
                </EnBadge>
              </div>

              <template v-if="selectedApplication">
                <dl class="mt-3 space-y-2 text-sm">
                  <div class="flex justify-between gap-3">
                    <dt class="text-slate-500">アプリ名</dt>
                    <dd class="min-w-0 truncate font-semibold text-slate-900">
                      {{ selectedApplication.name }}
                    </dd>
                  </div>
                  <div class="flex justify-between gap-3">
                    <dt class="text-slate-500">ストーリー</dt>
                    <dd class="font-semibold text-slate-900">
                      {{ storyCountFor(selectedApplication.id) }}
                    </dd>
                  </div>
                </dl>
                <div class="mt-4 flex flex-wrap justify-end gap-2">
                  <EnButton
                    variant="outline"
                    color="neutral"
                    size="sm"
                    @click="openApplication(selectedApplication.id)"
                  >
                    アプリ詳細
                  </EnButton>
                  <EnButton
                    variant="outline"
                    color="neutral"
                    size="sm"
                    @click="editApplication(selectedApplication)"
                  >
                    設定を編集
                  </EnButton>
                </div>
              </template>

              <template v-else>
                <p class="mt-3 text-sm leading-relaxed text-slate-500">
                  この Repository はまだ Application 設定されていません。
                </p>
                <div class="mt-4 flex justify-end">
                  <EnButton
                    variant="ai"
                    size="sm"
                    leading-icon="material-symbols:add"
                    @click="configureRepository(selectedRepository)"
                  >
                    このRepositoryをアプリ設定
                  </EnButton>
                </div>
              </template>
            </div>
          </div>
        </div>
      </template>
    </USlideover>
  </section>
</template>

<script setup lang="ts">
import type { DecodedStoryVaultApplication } from "@models/storyVault";
import type { GitHubRepositorySummary } from "@composables/useGitHubOAuth";

const props = defineProps<{
  applications: DecodedStoryVaultApplication[];
  storyCountByApplicationId: Record<string, number>;
}>();

const emit = defineEmits<{
  "open-application": [applicationId: string];
  "configure-repository": [repository: GitHubRepositorySummary];
  "edit-application": [application: DecodedStoryVaultApplication];
}>();

const github = useGitHubOAuth();
const searchQuery = ref("");
const repositoriesLoading = ref(false);
const errorMessage = ref("");
const repositoryDetailOpen = ref(false);
const selectedRepository = ref<GitHubRepositorySummary | null>(null);

const connection = computed(() => github.connection.value);
const repositories = computed(() => github.repositories.value);
const selectedApplication = computed(() =>
  selectedRepository.value ? applicationFor(selectedRepository.value) : null
);
const configuredRepositoryCount = computed(
  () => repositories.value.filter((repository) => applicationFor(repository)).length
);
const repositoryOverview = computed(() => [
  {
    label: "接続状態",
    value: connection.value.login || "GitHub",
    description: connection.value.connected ? "OAuth接続済み" : "未接続",
    icon: "i-simple-icons-github",
    iconClass: connection.value.connected
      ? "bg-emerald-50 text-emerald-700"
      : "bg-slate-100 text-slate-500",
  },
  {
    label: "取得リポジトリ",
    value: `${repositories.value.length}件`,
    description: "GitHubから取得した表示対象",
    icon: "material-symbols:folder-managed-outline",
    iconClass: "bg-cyan-50 text-cyan-700",
  },
  {
    label: "アプリ設定済み",
    value: `${configuredRepositoryCount.value}件`,
    description: "StoryVault アプリと紐付け済み",
    icon: "material-symbols:conversion-path",
    iconClass: "bg-violet-50 text-violet-700",
  },
]);

const filteredRepositories = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return repositories.value;
  return repositories.value.filter((repository) =>
    [
      repository.fullName,
      repository.name,
      repository.description,
      repository.language,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query))
  );
});

const repositoryStats = computed(() => {
  const repository = selectedRepository.value;
  if (!repository) return [];
  return [
    { label: "Stars", value: repository.stargazersCount ?? 0 },
    { label: "Forks", value: repository.forksCount ?? 0 },
    { label: "Watchers", value: repository.watchersCount ?? 0 },
    { label: "Updated", value: formatDate(repository.updatedAt) || "-" },
  ];
});

onMounted(() => {
  void refreshGitHubState();
});

function applicationFor(
  repository: GitHubRepositorySummary
): DecodedStoryVaultApplication | null {
  const repoFullName = repository.fullName.toLowerCase();
  return (
    props.applications.find(
      (application) => application.repoFullName.toLowerCase() === repoFullName
    ) ?? null
  );
}

function storyCountFor(applicationId: string): number {
  return props.storyCountByApplicationId[applicationId] ?? 0;
}

function openRepository(repository: GitHubRepositorySummary): void {
  selectedRepository.value = repository;
  repositoryDetailOpen.value = true;
}

function openApplication(applicationId: string): void {
  repositoryDetailOpen.value = false;
  emit("open-application", applicationId);
}

function configureRepository(repository: GitHubRepositorySummary): void {
  repositoryDetailOpen.value = false;
  emit("configure-repository", repository);
}

function editApplication(application: DecodedStoryVaultApplication): void {
  repositoryDetailOpen.value = false;
  emit("edit-application", application);
}

async function refreshGitHubState(): Promise<void> {
  errorMessage.value = "";
  try {
    const connectionState = await github.refreshConnection();
    if (connectionState.connected) {
      await loadRepositories();
    }
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "GitHub 接続状態の取得に失敗しました";
  }
}

async function connectGitHub(): Promise<void> {
  repositoriesLoading.value = true;
  errorMessage.value = "";
  try {
    const connected = await github.connect({
      switchAccount: connection.value.connected,
    });
    if (connected) {
      await loadRepositories();
    }
  } finally {
    repositoriesLoading.value = false;
  }
}

async function loadRepositories(): Promise<void> {
  repositoriesLoading.value = true;
  errorMessage.value = "";
  try {
    await github.listRepositories();
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "GitHub repository 一覧の取得に失敗しました";
  } finally {
    repositoriesLoading.value = false;
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
