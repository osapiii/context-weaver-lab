<template>
  <EnModal
    v-model:open="isOpen"
    :title="modalTitle"
    :subtitle="modalSubtitle"
    title-icon="material-symbols:apps-outline"
    size="3xl"
    padding="lg"
    :close-on-backdrop="!isSaving"
  >
    <div class="grid gap-4 md:grid-cols-2">
      <label class="block min-w-0 md:col-span-2">
        <span class="text-xs font-medium text-slate-600">アプリ名</span>
        <input
          v-model="form.name"
          type="text"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          placeholder="Customer Portal"
          :disabled="isSaving"
        >
      </label>

      <label class="block min-w-0">
        <span class="text-xs font-medium text-slate-600">App Key</span>
        <input
          v-model="form.applicationKey"
          type="text"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm uppercase text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          placeholder="VC"
          :disabled="isSaving"
        >
      </label>

      <label class="block min-w-0">
        <span class="text-xs font-medium text-slate-600">ドメイン</span>
        <input
          v-model="form.domain"
          type="text"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          placeholder="devops-governance"
          :disabled="isSaving"
        >
      </label>

      <label class="block min-w-0">
        <span class="text-xs font-medium text-slate-600">オーナー</span>
        <input
          v-model="form.owner"
          type="text"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          placeholder="Product team"
          :disabled="isSaving"
        >
      </label>

      <label class="block min-w-0">
        <span class="text-xs font-medium text-slate-600">ラベル</span>
        <input
          v-model="labelsText"
          type="text"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          placeholder="hackathon, governance"
          :disabled="isSaving"
        >
      </label>

      <label class="block min-w-0 md:col-span-2">
        <span class="text-xs font-medium text-slate-600">概要</span>
        <textarea
          v-model="form.summary"
          rows="3"
          class="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          placeholder="このアプリケーションが扱うプロダクト領域、対象ユーザー、管理したいストーリーの範囲"
          :disabled="isSaving"
        />
      </label>

      <label class="block min-w-0 md:col-span-2">
        <span class="text-xs font-medium text-slate-600">Start URL</span>
        <input
          v-model="form.startUrl"
          type="url"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          placeholder="https://example.com/"
          :disabled="isSaving"
        >
      </label>

      <label class="block min-w-0">
        <span class="text-xs font-medium text-slate-600">FileSpace ID</span>
        <input
          v-model="form.fileSpaceId"
          type="text"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          placeholder="w-default"
          :disabled="isSaving"
        >
      </label>

      <div class="min-w-0 md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-semibold text-slate-900">GitHub repository</p>
            <p class="mt-1 text-xs text-slate-500">
              App は GitHub repository と 1:1 で紐づきます。
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <EnBadge
              :color="github.connection.value.connected ? 'success' : 'warning'"
              size="xs"
            >
              {{ github.connection.value.connected ? `接続済み: ${github.connection.value.login || "GitHub"}` : "未接続" }}
            </EnBadge>
            <EnButton
              variant="outline"
              color="neutral"
              size="sm"
              :leading-icon="github.connection.value.connected ? 'i-heroicons-user-circle' : 'material-symbols:sync'"
              :loading="github.isLoading.value || repositoriesLoading"
              :disabled="isSaving"
              @click="connectGitHub"
            >
              {{ github.connection.value.connected ? "別アカウントで接続" : "GitHub接続" }}
            </EnButton>
          </div>
        </div>

        <label class="mt-3 block min-w-0">
          <span class="text-xs font-medium text-slate-600">Repository</span>
          <select
            v-model="form.repoFullName"
            class="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            :disabled="isSaving || repositoriesLoading || repositories.length === 0"
            @change="applySelectedRepository"
          >
            <option value="">GitHub repositoryを選択</option>
            <option
              v-if="form.repoFullName && !selectedRepository"
              :value="form.repoFullName"
            >
              {{ form.repoFullName }} / current
            </option>
            <option
              v-for="repository in selectableRepositories"
              :key="repository.fullName"
              :value="repository.fullName"
            >
              {{ repository.fullName }}{{ repository.private ? " / private" : " / public" }}
            </option>
          </select>
        </label>

        <div
          v-if="selectedRepository || form.repoFullName"
          class="mt-3 rounded-lg border border-slate-200 bg-white p-3"
        >
          <div class="flex flex-wrap items-center gap-2">
            <EnBadge size="xs" :color="selectedRepository?.private ? 'warning' : 'neutral'">
              {{ selectedRepository ? (selectedRepository.private ? "Private" : "Public") : "Repository" }}
            </EnBadge>
            <span class="font-mono text-xs font-semibold text-slate-600">
              {{ selectedRepository?.defaultBranch || form.defaultBranch || "main" }}
            </span>
            <span v-if="selectedRepository?.language" class="text-xs text-slate-500">
              {{ selectedRepository.language }}
            </span>
          </div>
          <p class="mt-2 text-sm font-semibold text-slate-900">
            {{ selectedRepository?.fullName || form.repoFullName }}
          </p>
          <p class="mt-1 text-xs leading-relaxed text-slate-500">
            {{ selectedRepository?.description || "GitHub接続後にrepository情報を取得できます。" }}
          </p>
        </div>
      </div>

      <label class="block min-w-0">
        <span class="text-xs font-medium text-slate-600">Default branch</span>
        <input
          v-model="form.defaultBranch"
          type="text"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          placeholder="main"
          :disabled="isSaving"
        >
      </label>
    </div>

    <EnAlert
      v-if="validationError"
      class="mt-4"
      color="error"
      :title="validationError"
    />

    <template #footer>
      <EnButton
        variant="ghost"
        color="neutral"
        size="sm"
        :disabled="isSaving"
        @click="close"
      >
        キャンセル
      </EnButton>
      <EnButton
        variant="ai"
        size="sm"
        leading-icon="material-symbols:save-outline"
        :loading="isSaving"
        :disabled="isSaving"
        @click="submit"
      >
        保存
      </EnButton>
    </template>
  </EnModal>
</template>

<script setup lang="ts">
import type { DecodedVibeControlApplication } from "@models/vibeControl";
import type { VibeControlApplicationInput } from "@stores/vibeControl";
import type { GitHubRepositorySummary } from "@composables/useGitHubOAuth";

const props = defineProps<{
  open: boolean;
  application?: DecodedVibeControlApplication | null;
  initialRepository?: GitHubRepositorySummary | null;
  applications: DecodedVibeControlApplication[];
  isSaving?: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  save: [input: VibeControlApplicationInput];
}>();

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit("update:open", value),
});

const form = reactive<VibeControlApplicationInput>({
  id: undefined,
  applicationKey: "",
  name: "",
  summary: "",
  domain: "",
  owner: "",
  labels: [],
  startUrl: "",
  fileSpaceId: "",
  repoFullName: "",
  defaultBranch: "main",
});
const labelsText = ref("");
const validationError = ref("");
const repositoriesLoading = ref(false);
const github = useGitHubOAuth();

const isEdit = computed(() => Boolean(props.application?.id));
const modalTitle = computed(() =>
  isEdit.value ? "アプリケーションを編集" : "アプリケーションを登録"
);
const modalSubtitle = computed(() =>
  isEdit.value
    ? "選択中アプリの基本情報と接続先を更新します"
    : "GitHub repositoryを起点にアプリケーションを登録します"
);

const repositories = computed(() => github.repositories.value);
const selectedRepository = computed<GitHubRepositorySummary | null>(
  () =>
    repositories.value.find(
      (repository) => repository.fullName === form.repoFullName
    ) ?? null
);

const selectableRepositories = computed(() =>
  repositories.value.filter((repository) => {
    const duplicated = props.applications.some(
      (application) =>
        application.id !== form.id &&
        application.repoFullName.toLowerCase() === repository.fullName.toLowerCase()
    );
    return !duplicated || repository.fullName === form.repoFullName;
  })
);

watch(
  () => [props.open, props.application, props.initialRepository] as const,
  () => {
    if (!props.open) return;
    const application = props.application;
    const repository = application ? null : props.initialRepository;
    form.id = application?.id;
    form.applicationKey =
      application?.applicationKey ?? applicationKeyFromRepository(repository);
    form.name = application?.name ?? repository?.name ?? "";
    form.summary = application?.summary ?? repository?.description ?? "";
    form.domain = application?.domain ?? "";
    form.owner = application?.owner ?? "";
    form.labels = application?.labels ?? [];
    labelsText.value = application?.labels.join(", ") ?? "";
    form.startUrl =
      application?.startUrl ?? application?.lastScan?.startUrl ?? "";
    form.fileSpaceId = application?.fileSpaceId ?? "";
    form.repoFullName = application?.repoFullName ?? repository?.fullName ?? "";
    form.defaultBranch =
      application?.defaultBranch ?? repository?.defaultBranch ?? "main";
    validationError.value = "";
    void loadGitHubState();
  },
  { immediate: true }
);

function close(): void {
  isOpen.value = false;
}

function submit(): void {
  validationError.value = "";
  if (!form.name.trim()) {
    validationError.value = "アプリ名を入力してください";
    return;
  }
  if (!form.repoFullName.trim()) {
    validationError.value = "GitHub repositoryを選択してください";
    return;
  }
  const duplicated = props.applications.find(
    (application) =>
      application.id !== form.id &&
      application.repoFullName.toLowerCase() === form.repoFullName.trim().toLowerCase()
  );
  if (duplicated) {
    validationError.value = `${form.repoFullName} は ${duplicated.name} に登録済みです`;
    return;
  }
  const labels = labelsText.value
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean);
  emit("save", {
    ...form,
    applicationKey: form.applicationKey.trim(),
    name: form.name.trim(),
    startUrl: form.startUrl?.trim(),
    repoFullName: form.repoFullName.trim(),
    labels,
  });
}

async function loadGitHubState(): Promise<void> {
  if (!props.open) return;
  repositoriesLoading.value = true;
  try {
    const connection = await github.refreshConnection();
    if (connection.connected) {
      await github.listRepositories();
      applySelectedRepository();
    }
  } finally {
    repositoriesLoading.value = false;
  }
}

async function connectGitHub(): Promise<void> {
  repositoriesLoading.value = true;
  try {
    const connected = await github.connect({
      switchAccount: github.connection.value.connected,
    });
    if (connected) {
      await github.listRepositories();
      applySelectedRepository();
    }
  } finally {
    repositoriesLoading.value = false;
  }
}

function applySelectedRepository(): void {
  const repository = selectedRepository.value;
  if (!repository) return;
  form.defaultBranch = repository.defaultBranch || "main";
  if (!form.name.trim()) {
    form.name = repository.name || repository.fullName;
  }
  if (!form.summary?.trim() && repository.description) {
    form.summary = repository.description;
  }
  if (!form.applicationKey.trim()) {
    form.applicationKey = applicationKeyFromRepository(repository);
  }
}

function applicationKeyFromRepository(
  repository?: GitHubRepositorySummary | null
): string {
  if (!repository?.name) return "";
  return repository.name
    .split(/[-_\s]+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 6)
    .toUpperCase();
}
</script>
