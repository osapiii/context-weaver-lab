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
        <div class="space-y-4">
          <VibeControlStoryGenerationPanel
            :application="selectedApplication"
            :capabilities="store.activeCapabilities"
            :stories="store.activeStories"
            :evidence="store.activeEvidence"
            :source-assets="store.activeSourceAssets"
            :is-generating="store.isGenerating"
            @generate-stories="startStoryGeneration"
          />

          <VibeControlGovernanceHud
            :application="selectedApplication"
            :stories="store.activeStories"
            :filtered-count="store.filteredStories.length"
            :filters="store.filters"
            :domains="store.domains"
            :milestones="store.milestones"
            @update-filter="updateStoryFilter"
            @clear-filters="store.clearFilters()"
          />

          <VibeControlStoryBoard
            :stories="store.filteredStories"
            :evidence-count-by-story="store.evidenceCountByStory"
            :selected-story-id="store.selectedStoryId"
            @select-story="openStoryDetail"
          />
        </div>
      </template>

      <template v-else-if="activeApplicationTab === 'capabilities'">
        <VibeControlGenerationWorkbench
          :application="selectedApplication"
          :capabilities="store.activeCapabilities"
          :stories="store.activeStories"
          :evidence="store.activeEvidence"
          :source-assets="store.activeSourceAssets"
          :generation-sessions="store.activeGenerationSessions"
          :is-generating="store.isGenerating"
          @structure-capabilities="startCapabilityStructuring"
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

      <template v-else-if="activeApplicationTab === 'knowledge-space'">
        <VibeControlApplicationKnowledgeSpacePanel
          v-if="!applicationKnowledgeFileSpaceId"
          :application="selectedApplication"
          :is-provisioning="store.isProvisioningApplicationFileSpace"
          :is-uploading="isUploadingApplicationKnowledge"
          @create-file-space="provisionSelectedApplicationFileSpace"
          @upload-files="uploadApplicationKnowledgeFiles"
          @refresh="store.fetchFromFirestore()"
        />

        <div
          v-else
          class="space-y-5"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                Knowledge Space
              </p>
              <p class="mt-1 break-all text-sm font-semibold text-slate-900">
                {{ applicationKnowledgeFileSpaceId }}
              </p>
            </div>
            <div class="flex shrink-0 flex-wrap items-center gap-2">
              <EnToggle
                v-model="applicationKnowledgeMode"
                :items="applicationKnowledgeModeItems"
              />
              <EnButton
                variant="outline"
                color="neutral"
                size="sm"
                leading-icon="material-symbols:refresh"
                :loading="isApplicationKnowledgeLoading"
                @click="refreshApplicationKnowledgeDocuments"
              >
                再読込
              </EnButton>
            </div>
          </div>

          <Transition
            enter-active-class="transition duration-300 ease-out"
            enter-from-class="opacity-0 translate-y-4"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 -translate-y-4"
            mode="out-in"
          >
            <DataSourceUploadMode
              v-if="applicationKnowledgeMode === 'upload'"
              :file-space-id="applicationKnowledgeFileSpaceId"
              :documents="selectedApplicationKnowledgeDocuments"
              :is-loading-documents="isApplicationKnowledgeLoading"
              @refresh="refreshApplicationKnowledgeDocuments"
              @switch-to-view="applicationKnowledgeMode = 'view'"
            />
            <DataSourceViewMode
              v-else
              :file-space-id="applicationKnowledgeFileSpaceId"
              :documents="selectedApplicationKnowledgeDocuments"
              :is-loading-documents="isApplicationKnowledgeLoading"
              @refresh="refreshApplicationKnowledgeDocuments"
            />
          </Transition>
        </div>
      </template>

      <VibeControlOperationVideoPanel
        v-else-if="activeApplicationTab === 'operation-videos'"
        :application="selectedApplication"
        :videos="store.activeOperationVideos"
        :is-saving="store.isSavingOperationVideo"
        :is-provisioning-file-space="store.isProvisioningApplicationFileSpace"
        @create-file-space="provisionSelectedApplicationFileSpace"
        @save="saveOperationVideo"
        @refresh="store.fetchFromFirestore()"
      />

      <VibeControlApplicationGitPanel
        v-else
        :application="selectedApplication"
      />
    </template>

    <template v-else>
      <VibeControlStoryDetail
        :story="selectedStory"
        :evidence="store.selectedEvidence"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useVibeControlStore } from "@stores/vibeControl";
import { useGeminiFileSpaceOperatorStore } from "@stores/geminiFileSpaceOperator";
import { useGlobalLoadingStore } from "@stores/global-loading";
import { useOrganizationStore } from "@stores/organization";
import { useSpaceStore } from "@stores/space";
import { useGeminiFileSpaceSnapshot } from "@composables/useGeminiFileSpaceSnapshot";
import { useGoogleDriveFolderSync } from "@composables/useGoogleDriveFolderSync";
import DataSourceUploadMode from "@components/dataSource/DataSourceUploadMode.vue";
import DataSourceViewMode from "@components/dataSource/DataSourceViewMode.vue";
import VibeControlApplicationKnowledgeSpacePanel from "@components/vibeControl/VibeControlApplicationKnowledgeSpacePanel.vue";
import type { ApplicationScanFields } from "@utils/applicationScanWorkspaceState";
import type { DecodedVibeControlApplication } from "@models/vibeControl";
import type { Document } from "@models/geminiFileSpaceRequest";
import type {
  VibeControlApplicationInput,
  VibeControlFilters,
  VibeControlGenerationInput,
  VibeControlOperationVideoSaveInput,
} from "@stores/vibeControl";
import type { GitHubRepositorySummary } from "@composables/useGitHubOAuth";

type VibeControlView =
  | "repositories"
  | "application-detail"
  | "story-detail";
type ApplicationDetailTab =
  | "capabilities"
  | "stories"
  | "basic"
  | "scan"
  | "knowledge-space"
  | "operation-videos"
  | "git";
type ApplicationKnowledgeMode = "upload" | "view";
type RouteView =
  | "repositories"
  | "application-detail"
  | "application-capabilities"
  | "application-scan"
  | "application-knowledge"
  | "application-videos"
  | "stories";

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
const fileSpaceStore = useGeminiFileSpaceOperatorStore();
const organizationStore = useOrganizationStore();
const spaceStore = useSpaceStore();
const globalLoading = useGlobalLoadingStore();
const toast = useToast();
const route = useRoute();
const router = useRouter();
const { documents: fileSpaceDocuments, isLoadingDocuments } =
  storeToRefs(fileSpaceStore);
const { syncCompletedTick } = useGoogleDriveFolderSync();
const currentView = ref<VibeControlView>("application-detail");
const activeApplicationTab = ref<ApplicationDetailTab>("stories");
const applicationKnowledgeMode = ref<ApplicationKnowledgeMode>("upload");
const applicationKnowledgeDocumentsByFileSpace = ref<Record<string, Document[]>>(
  {}
);
const applicationModalOpen = ref(false);
const scanSettingsModalOpen = ref(false);
const deleteConfirmOpen = ref(false);
const editingApplicationId = ref<string | null>(null);
const initialApplicationRepository = ref<GitHubRepositorySummary | null>(null);
const isUploadingApplicationKnowledge = ref(false);

const selectedApplication = computed(() => store.selectedApplication);
const selectedStory = computed(() => store.selectedStory);
const applicationKnowledgeFileSpaceId = computed(
  () => selectedApplication.value?.fileSpaceId?.trim() || null
);
const selectedApplicationKnowledgeDocuments = computed(() => {
  const fileSpaceId = applicationKnowledgeFileSpaceId.value;
  if (!fileSpaceId) return [];
  return applicationKnowledgeDocumentsByFileSpace.value[fileSpaceId] ?? [];
});
const isApplicationKnowledgeLoading = computed(() => isLoadingDocuments.value);
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
    value: "capabilities",
    label: "Capability",
    icon: "material-symbols:account-tree-outline",
    count: store.activeCapabilities.length,
  },
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
    label: "Visual QA",
    icon: "material-symbols:preview-outline",
    count: selectedApplication.value?.lastScan?.artifactCount,
  },
  {
    value: "knowledge-space",
    label: "ナレッジスペース",
    icon: "material-symbols:hub-outline",
    count: applicationKnowledgeFileSpaceId.value
      ? selectedApplicationKnowledgeDocuments.value.length
      : undefined,
  },
  {
    value: "operation-videos",
    label: "操作動画",
    icon: "material-symbols:video-camera-back-outline",
    count: store.activeOperationVideos.length,
  },
  {
    value: "git",
    label: "Git",
    icon: "i-simple-icons-github",
  },
]);

const applicationKnowledgeModeItems = computed(() => [
  {
    value: "upload",
    label: "知識を教える",
    icon: "i-heroicons-academic-cap",
  },
  {
    value: "view",
    label: "知識を確認",
    icon: "i-heroicons-magnifying-glass",
    count: selectedApplicationKnowledgeDocuments.value.length,
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
          : activeApplicationTab.value === "capabilities"
            ? "Capability"
          : activeApplicationTab.value === "scan"
            ? "Visual QA"
          : activeApplicationTab.value === "knowledge-space"
            ? "ナレッジスペース"
          : activeApplicationTab.value === "operation-videos"
            ? "操作動画"
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
  const viewByTab: Record<ApplicationDetailTab, RouteView> = {
    capabilities: "application-capabilities",
    stories: "stories",
    basic: "application-detail",
    scan: "application-scan",
    "knowledge-space": "application-knowledge",
    "operation-videos": "application-videos",
    git: "application-detail",
  };
  updateViewQuery(viewByTab[tab]);
});

watch(
  [activeApplicationTab, applicationKnowledgeFileSpaceId],
  ([tab, fileSpaceId]) => {
    if (tab !== "knowledge-space" || !fileSpaceId) return;
    void refreshApplicationKnowledgeDocuments();
  }
);

watch(syncCompletedTick, () => {
  if (activeApplicationTab.value !== "knowledge-space") return;
  void refreshApplicationKnowledgeDocuments();
});

function routeView(): RouteView {
  if (route.query.view === "repositories") return "repositories";
  if (route.query.view === "stories") return "stories";
  if (route.query.view === "application-capabilities") {
    return "application-capabilities";
  }
  if (route.query.view === "application-scan") return "application-scan";
  if (route.query.view === "application-knowledge") return "application-knowledge";
  if (route.query.view === "application-videos") return "application-videos";
  if (route.query.view === "application-detail") return "application-detail";
  return "stories";
}

function updateViewQuery(view: RouteView): void {
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

  if (routeView() === "application-capabilities") {
    if (!selectedApplication.value && store.applications[0]) {
      store.selectApplication(store.applications[0].id);
    }
    if (selectedApplication.value) {
      activeApplicationTab.value = "capabilities";
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
  if (routeView() === "application-knowledge") {
    if (!selectedApplication.value && store.applications[0]) {
      store.selectApplication(store.applications[0].id);
    }
    if (selectedApplication.value) {
      activeApplicationTab.value = "knowledge-space";
      currentView.value = "application-detail";
    }
    return;
  }
  if (routeView() === "application-videos") {
    if (!selectedApplication.value && store.applications[0]) {
      store.selectApplication(store.applications[0].id);
    }
    if (selectedApplication.value) {
      activeApplicationTab.value = "operation-videos";
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

function updateStoryFilter<K extends keyof VibeControlFilters>(
  key: K,
  value: VibeControlFilters[K]
): void {
  store.setFilter(key, value);
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

async function startCapabilityStructuring(
  input: VibeControlGenerationInput
): Promise<void> {
  try {
    const requestId = await store.startCapabilityStructuring({
      applicationId: input.applicationId || store.selectedApplicationId,
      prompt:
        input.prompt ||
        `${input.applicationName} のCapability構造をSourceAssetから解析してください。`,
    });
    toast.add({
      title: "Capability解析ADKを開始しました",
      description: requestId,
      color: "success",
    });
  } catch (err) {
    toast.add({
      title: "Capability解析ADKの開始に失敗しました",
      description: err instanceof Error ? err.message : String(err),
      color: "error",
    });
  }
}

async function startStoryGeneration(
  input: VibeControlGenerationInput
): Promise<void> {
  try {
    const requestId = await store.startStoryGeneration({
      applicationId: input.applicationId || store.selectedApplicationId,
      capabilityId: input.capabilityId,
      prompt:
        input.prompt ||
        `${input.applicationName} のCapability配下に置くユーザーストーリーを生成してください。`,
    });
    toast.add({
      title: "Story生成ADKを開始しました",
      description: requestId,
      color: "success",
    });
  } catch (err) {
    toast.add({
      title: "Story生成ADKの開始に失敗しました",
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

async function provisionSelectedApplicationFileSpace(): Promise<void> {
  const application = selectedApplication.value;
  if (!application) return;

  try {
    const requestId = await store.provisionApplicationFileSpace(application.id);
    if (requestId === application.fileSpaceId) {
      toast.add({
        title: "専用FileSpaceは設定済みです",
        description: application.fileSpaceId,
        color: "success",
      });
      return;
    }

    toast.add({
      title: "専用FileSpaceの作成を開始しました",
      description: requestId,
      color: "success",
    });

    let watcher: ReturnType<typeof useGeminiFileSpaceSnapshot> | null = null;
    watcher = useGeminiFileSpaceSnapshot(requestId, (request) => {
      void store
        .resolveApplicationFileSpaceProvisioning({
          applicationId: application.id,
          request,
        })
        .then((updatedApplication) => {
          if (request.status === "completed") {
            toast.add({
              title: "アプリに専用FileSpaceを紐付けました",
              description: updatedApplication?.fileSpaceId,
              color: "success",
            });
            if (activeApplicationTab.value === "knowledge-space") {
              void refreshApplicationKnowledgeDocuments();
            }
            watcher?.unsubscribe();
          } else if (request.status === "error") {
            toast.add({
              title: "専用FileSpaceの作成に失敗しました",
              description:
                request.errorMessage ||
                updatedApplication?.fileSpaceErrorMessage ||
                "RequestDocを確認してください",
              color: "error",
            });
            watcher?.unsubscribe();
          }
        });
    });
  } catch (err) {
    toast.add({
      title: "専用FileSpaceの作成に失敗しました",
      description: err instanceof Error ? err.message : String(err),
      color: "error",
    });
  }
}

async function refreshApplicationKnowledgeDocuments(): Promise<void> {
  const fileSpaceId = applicationKnowledgeFileSpaceId.value;
  if (!fileSpaceId) return;
  await fileSpaceStore.fetchDocumentsFromFirestore(fileSpaceId);
  applicationKnowledgeDocumentsByFileSpace.value = {
    ...applicationKnowledgeDocumentsByFileSpace.value,
    [fileSpaceId]: [...fileSpaceDocuments.value],
  };
}

async function uploadApplicationKnowledgeFiles(files: File[]): Promise<void> {
  const application = selectedApplication.value;
  const fileSpaceId = application?.fileSpaceId?.trim();
  if (!application || !fileSpaceId) {
    toast.add({
      title: "専用FileSpaceを作成してください",
      color: "warning",
    });
    return;
  }

  const organizationId = organizationStore.getLoggedInOrganizationId;
  const spaceId = spaceStore.selectedSpace?.id;
  if (!organizationId || !spaceId) {
    toast.add({
      title: "組織・スペースを確認してください",
      color: "error",
    });
    return;
  }

  isUploadingApplicationKnowledge.value = true;
  const succeeded: string[] = [];
  const failed: string[] = [];
  try {
    for (const file of files) {
      try {
        const requestDoc = await fileSpaceStore.uploadFileToFileSpace({
          storeId: fileSpaceId,
          file,
          mimeType: file.type || undefined,
          description: `VibeControl knowledge for ${application.name}: ${file.name}`,
          organizationId,
          spaceId,
        });
        if (!requestDoc?.id) {
          failed.push(file.name);
          continue;
        }
        useGeminiFileSpaceSnapshot(requestDoc.id);
        succeeded.push(file.name);
      } catch {
        failed.push(file.name);
      }
    }
  } finally {
    isUploadingApplicationKnowledge.value = false;
    globalLoading.stopLoading();
  }

  if (succeeded.length > 0) {
    toast.add({
      title: `${succeeded.length}件を専用FileSpaceに投入しました`,
      description: application.name,
      color: "success",
    });
  }
  if (failed.length > 0) {
    toast.add({
      title: `${failed.length}件の投入に失敗しました`,
      description: failed.join(", "),
      color: "error",
    });
  }
}

async function saveOperationVideo(
  input: VibeControlOperationVideoSaveInput
): Promise<void> {
  try {
    const video = await store.saveOperationVideoCapture(input);
    toast.add({
      title: "操作動画を保存しました",
      description:
        video.discoveryStatus === "queued"
          ? "DiscoveryEngine登録を開始しました"
          : "動画は保存されましたが、検索登録を確認してください",
      color: video.discoveryStatus === "queued" ? "success" : "warning",
    });
  } catch (err) {
    toast.add({
      title: "操作動画の保存に失敗しました",
      description: err instanceof Error ? err.message : String(err),
      color: "error",
    });
  }
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
