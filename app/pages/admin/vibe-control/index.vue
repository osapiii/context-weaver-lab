<template>
  <div class="space-y-5">
    <VibeControlApplicationFormModal
      v-model:open="applicationModalOpen"
      :application="editingApplication"
      :initial-repository="initialApplicationRepository"
      :applications="store.applications"
      :is-saving="store.isLoading"
      @save="saveApplication"
    />

    <VibeControlApplicationScanPanel
      v-model:open="scanSettingsModalOpen"
      variant="modal"
      :applications="store.applications"
      :selected-application-id="store.selectedApplicationId"
      :is-starting-scan="store.isStartingApplicationScan"
      @select-application="store.selectApplication($event)"
      @start-scan="startApplicationScan"
      @open-job-log="openJobLog"
    />

    <EnModal
      v-model:open="deleteConfirmOpen"
      title="アプリケーションを削除しますか?"
      header-variant="warning"
      title-icon="material-symbols:delete-outline"
      size="lg"
    >
      <p class="text-sm leading-relaxed text-slate-700">
        {{ selectedApplication?.name }} と、その配下に読み込まれているストーリー、根拠、ソース接続を削除します。
      </p>
      <p class="mt-2 text-xs text-slate-500">
        少なくとも1つのアプリケーションが必要なため、最後の1件は削除できません。
      </p>
      <template #footer>
        <EnButton
          variant="ghost"
          color="neutral"
          size="sm"
          :disabled="store.isLoading"
          @click="deleteConfirmOpen = false"
        >
          キャンセル
        </EnButton>
        <EnButton
          variant="soft"
          color="error"
          size="sm"
          leading-icon="material-symbols:delete-outline"
          :loading="store.isLoading"
          @click="deleteSelectedApplication"
        >
          削除
        </EnButton>
      </template>
    </EnModal>

    <UBreadcrumb
      :items="breadcrumbItems"
      class="text-xs"
      :ui="{
        list: 'gap-1.5',
        link: 'text-xs font-semibold',
        linkLabel: 'truncate',
        separatorIcon: 'h-3.5 w-3.5 text-slate-300',
      }"
    />

    <EnAiPageHeader
      :title="pageTitle"
      :subtitle="pageSubtitle"
      :icon="pageIcon"
    >
      <template #trailing>
        <div class="flex flex-wrap items-center gap-2">
          <EnButton
            variant="outline"
            color="neutral"
            size="sm"
            leading-icon="material-symbols:refresh"
            :loading="store.isLoading"
            @click="store.fetchFromFirestore()"
          >
            再読込
          </EnButton>
        </div>
      </template>
    </EnAiPageHeader>

    <EnAlert
      v-if="store.error"
      color="warning"
      :title="store.error"
    />

    <VibeControlRepositoryList
      v-if="currentView === 'repositories'"
      :applications="store.applications"
      :story-count-by-application-id="storyCountByApplicationId"
      @open-application="openApplicationDetail"
      @configure-repository="openCreateApplicationModalForRepository"
      @edit-application="openEditApplicationModal"
    />

    <template v-else-if="currentView === 'application-detail'">
      <EnToggle
        v-model="activeApplicationTab"
        :items="applicationTabItems"
        custom-class="max-w-full overflow-x-auto"
      />

      <template v-if="activeApplicationTab === 'stories'">
        <VibeControlStoryList
          :stories="store.activeStories"
          :evidence-count-by-story="store.evidenceCountByStory"
          :selected-story-id="store.selectedStoryId"
          @open-story="openStoryDetail"
        />
      </template>

      <template v-else-if="activeApplicationTab === 'basic'">
        <VibeControlApplicationDetail
          :application="selectedApplication"
          :story-count="store.activeStories.length"
          :average-confidence="store.averageConfidence"
          :needs-review-count="store.needsReviewCount"
          :high-drift-count="store.highDriftCount"
          :delete-disabled="store.applications.length <= 1"
          @create="openCreateApplicationModal"
          @edit="openEditApplicationModal"
          @delete="openDeleteConfirm"
        />

        <VibeControlApplicationScanPanel
          :applications="store.applications"
          :selected-application-id="store.selectedApplicationId"
          :is-starting-scan="store.isStartingApplicationScan"
          @select-application="store.selectApplication($event)"
          @start-scan="startApplicationScan"
          @open-job-log="openJobLog"
        />

        <VibeControlSourceSetup
          :selected-application="selectedApplication"
          :source-connections="store.activeSourceConnections"
          :is-generating="store.isGenerating"
          @generate="store.runMockGeneration($event)"
          @persist="store.persistCurrentSnapshot()"
        />
      </template>

      <VibeControlApplicationScanResultsPanel
        v-else-if="activeApplicationTab === 'scan'"
        :application="selectedApplication"
        :run="selectedApplication?.lastScan ?? null"
        :is-starting-scan="store.isStartingApplicationScan"
        @rescan="rescanSelectedApplication"
      />

      <VibeControlApplicationGitPanel
        v-else
        :application="selectedApplication"
      />
    </template>

    <template v-else>
      <VibeControlStoryDetail
        :story="selectedStory"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useVibeControlStore } from "@stores/vibeControl";
import type { ApplicationScanFields } from "@utils/applicationScanWorkspaceState";
import type { DecodedVibeControlApplication } from "@models/vibeControl";
import type { VibeControlApplicationInput } from "@stores/vibeControl";
import type { GitHubRepositorySummary } from "@composables/useGitHubOAuth";

type VibeControlView =
  | "repositories"
  | "application-detail"
  | "story-detail";
type ApplicationDetailTab = "stories" | "basic" | "scan" | "git";

defineOptions({
  name: "AdminVibeControlIndexPage",
});

definePageMeta({
  name: "admin-vibe-control",
  layout: "admin",
  middleware: ["admin-logged-in-check"],
  adminPageStack: false,
});

const store = useVibeControlStore();
const toast = useToast();
const route = useRoute();
const router = useRouter();
const currentView = ref<VibeControlView>("application-detail");
const activeApplicationTab = ref<ApplicationDetailTab>("stories");
const applicationModalOpen = ref(false);
const scanSettingsModalOpen = ref(false);
const deleteConfirmOpen = ref(false);
const editingApplicationId = ref<string | null>(null);
const initialApplicationRepository = ref<GitHubRepositorySummary | null>(null);

const selectedApplication = computed(() => store.selectedApplication);
const selectedStory = computed(() => store.selectedStory);
const editingApplication = computed(() =>
  editingApplicationId.value
    ? store.applications.find(
        (application) => application.id === editingApplicationId.value
      ) ?? null
    : null
);

const pageTitle = computed(() => {
  if (currentView.value === "repositories") {
    return "Repository一覧";
  }
  if (currentView.value === "story-detail") {
    return selectedStory.value?.title ?? "ユーザーストーリー";
  }
  return selectedApplication.value?.name ?? "アプリ詳細";
});

const pageIcon = computed(() => {
  if (currentView.value === "repositories") return "i-simple-icons-github";
  if (currentView.value === "application-detail") {
    return "flat-color-icons:deployment";
  }
  return pageTitle.value.includes("ユーザーストーリー")
    ? "flat-color-icons:flow-chart"
    : "flat-color-icons:deployment";
});

const pageSubtitle = computed(() => {
  if (currentView.value === "repositories") {
    return "GitHub 連携済み repository と Application 設定状況を確認します";
  }
  if (currentView.value === "story-detail") {
    return selectedStory.value
      ? `${selectedStory.value.storyKey} / ${selectedStory.value.applicationKey}`
      : "ユーザーストーリーを確認します";
  }
  if (!selectedApplication.value) {
    return "アプリケーションを選択してください";
  }
  return (
    selectedApplication.value.summary ||
    selectedApplication.value.repoFullName ||
    `${selectedApplication.value.applicationKey} のアプリケーション情報`
  );
});

const applicationTabItems = computed(() => [
  {
    value: "stories",
    label: "ユーザーストーリー",
    icon: "material-symbols:article-outline",
    count: store.activeStories.length,
  },
  {
    value: "basic",
    label: "基本情報",
    icon: "material-symbols:settings-outline-rounded",
  },
  {
    value: "scan",
    label: "スキャン結果",
    icon: "material-symbols:radar",
    count: selectedApplication.value?.lastScan?.artifactCount,
  },
  {
    value: "git",
    label: "Git",
    icon: "i-simple-icons-github",
  },
]);

const breadcrumbItems = computed(() => {
  const items: Array<{
    label: string;
    icon?: string;
    onClick?: () => void;
    disabled?: boolean;
  }> = [];

  if (currentView.value === "repositories") {
    items.push({
      label: "Repository一覧",
      disabled: true,
    });
    return items;
  }

  items.push({
    label: selectedApplication.value?.name ?? "アプリ詳細",
    onClick: showApplicationDetail,
  });

  if (currentView.value === "story-detail") {
    items.push({
      label: "ユーザーストーリー一覧",
      onClick: showApplicationDetail,
    });
    items.push({
      label: selectedStory.value?.storyKey ?? "ユーザーストーリー",
      disabled: true,
    });
  } else if (selectedApplication.value && currentView.value === "application-detail") {
    items.push({
      label:
        activeApplicationTab.value === "basic"
          ? "基本情報"
          : activeApplicationTab.value === "scan"
            ? "スキャン結果"
          : activeApplicationTab.value === "git"
            ? "Git"
            : "ユーザーストーリー",
      disabled: true,
    });
  }

  return items;
});

const storyCountByApplicationId = computed<Record<string, number>>(() => {
  const counts: Record<string, number> = {};
  for (const application of store.applications) {
    counts[application.id] = store.stories.filter(
      (story) => story.applicationId === application.id
    ).length;
  }
  return counts;
});

onMounted(() => {
  applyRouteView();
  void store.fetchFromFirestore().then(() => {
    applyRouteView();
    applyRouteAction();
  });
});

watch(
  () => route.query.view,
  () => {
    applyRouteView();
  }
);

watch(
  () => route.query.applicationId,
  () => {
    applyRouteApplication();
  }
);

watch(
  () => route.query.action,
  () => {
    applyRouteAction();
  }
);

watch(activeApplicationTab, (tab) => {
  if (currentView.value !== "application-detail") return;
  updateViewQuery(
    tab === "basic"
      ? "application-detail"
      : tab === "scan"
        ? "application-scan"
        : "stories"
  );
});

function routeView():
  | "repositories"
  | "application-detail"
  | "application-scan"
  | "stories" {
  if (route.query.view === "repositories") return "repositories";
  if (route.query.view === "stories") return "stories";
  if (route.query.view === "application-scan") return "application-scan";
  if (route.query.view === "application-detail") return "application-detail";
  return "stories";
}

function updateViewQuery(
  view: "repositories" | "application-detail" | "application-scan" | "stories"
): void {
  if (routeView() === view) return;
  void router.replace({
    query: {
      ...route.query,
      view,
      action: undefined,
    },
  });
}

function applyRouteView(): void {
  normalizeLegacyApplicationView();
  applyRouteApplication();

  if (routeView() === "repositories") {
    currentView.value = "repositories";
    return;
  }

  if (routeView() === "stories") {
    if (!selectedApplication.value && store.applications[0]) {
      store.selectApplication(store.applications[0].id);
    }
    if (selectedApplication.value) {
      activeApplicationTab.value = "stories";
      currentView.value = "application-detail";
    }
    return;
  }

  if (routeView() === "application-detail") {
    if (!selectedApplication.value && store.applications[0]) {
      store.selectApplication(store.applications[0].id);
    }
    if (selectedApplication.value) {
      activeApplicationTab.value = "basic";
      currentView.value = "application-detail";
    }
    return;
  }
  if (routeView() === "application-scan") {
    if (!selectedApplication.value && store.applications[0]) {
      store.selectApplication(store.applications[0].id);
    }
    if (selectedApplication.value) {
      activeApplicationTab.value = "scan";
      currentView.value = "application-detail";
    }
    return;
  }
  showApplicationDetail();
}

function applyRouteApplication(): void {
  const applicationId =
    typeof route.query.applicationId === "string"
      ? route.query.applicationId
      : "";
  if (!applicationId) return;
  if (store.selectedApplicationId === applicationId) return;
  if (!store.applications.some((application) => application.id === applicationId)) {
    return;
  }
  store.selectApplication(applicationId);
}

function normalizeLegacyApplicationView(): void {
  if (route.query.view !== "applications") return;
  void router.replace({
    query: {
      ...route.query,
      view: "stories",
    },
  });
}

function showApplicationDetail(): void {
  if (!selectedApplication.value && store.applications[0]) {
    store.selectApplication(store.applications[0].id);
  }
  activeApplicationTab.value = "stories";
  currentView.value = "application-detail";
  updateViewQuery("stories");
}

function applyRouteAction(): void {
  if (route.query.action !== "create-app") return;
  openCreateApplicationModal();
  void router.replace({
    query: {
      ...route.query,
      action: undefined,
    },
  });
}

function openApplicationDetail(applicationId: string): void {
  store.selectApplication(applicationId);
  activeApplicationTab.value = "stories";
  currentView.value = "application-detail";
  updateViewQuery("stories");
}

function openStoryDetail(storyId: string): void {
  store.selectStory(storyId);
  currentView.value = "story-detail";
  updateViewQuery("stories");
}

function openCreateApplicationModal(): void {
  editingApplicationId.value = null;
  initialApplicationRepository.value = null;
  applicationModalOpen.value = true;
}

function openCreateApplicationModalForRepository(
  repository: GitHubRepositorySummary
): void {
  editingApplicationId.value = null;
  initialApplicationRepository.value = repository;
  applicationModalOpen.value = true;
}

function openEditApplicationModal(application?: DecodedVibeControlApplication): void {
  const target = application ?? selectedApplication.value;
  if (!target) return;
  editingApplicationId.value = target.id;
  initialApplicationRepository.value = null;
  applicationModalOpen.value = true;
}

async function saveApplication(input: VibeControlApplicationInput): Promise<void> {
  const application = await store.upsertApplication(input);
  applicationModalOpen.value = false;
  editingApplicationId.value = null;
  initialApplicationRepository.value = null;
  store.selectApplication(application.id);
  activeApplicationTab.value = "basic";
  currentView.value = "application-detail";
  updateViewQuery("application-detail");
  toast.add({
    title: "アプリケーションを保存しました",
    description: application.name,
    color: "success",
  });
}

async function startApplicationScan(fields: ApplicationScanFields): Promise<void> {
  try {
    const requestId = await store.startApplicationScan({
      applicationId: store.selectedApplicationId,
      fields,
    });
    scanSettingsModalOpen.value = false;
    toast.add({
      title: "Application Scanを開始しました",
      description: requestId,
      color: "success",
    });
  } catch (err) {
    toast.add({
      title: "Application Scanの開始に失敗しました",
      description: err instanceof Error ? err.message : String(err),
      color: "error",
    });
  }
}

async function rescanSelectedApplication(): Promise<void> {
  const application = selectedApplication.value;
  if (!application) return;
  scanSettingsModalOpen.value = true;
}

function openJobLog(): void {
  void router.push({ name: "admin-workflow-executions" });
}

function openDeleteConfirm(): void {
  if (!selectedApplication.value || store.applications.length <= 1) return;
  deleteConfirmOpen.value = true;
}

async function deleteSelectedApplication(): Promise<void> {
  if (!selectedApplication.value) return;
  const applicationName = selectedApplication.value.name;
  const deleted = await store.deleteApplication(selectedApplication.value.id);
  if (!deleted) return;
  deleteConfirmOpen.value = false;
  showApplicationDetail();
  toast.add({
    title: "アプリケーションを削除しました",
    description: applicationName,
    color: "success",
  });
}
</script>
