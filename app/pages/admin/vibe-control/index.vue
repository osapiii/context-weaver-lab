<template>
  <div class="space-y-5">
    <VibeControlApplicationFormModal
      v-model:open="applicationModalOpen"
      :application="editingApplication"
      :applications="store.applications"
      :is-saving="store.isLoading"
      @save="saveApplication"
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

    <VibeControlApplicationList
      v-if="currentView === 'applications'"
      :applications="store.applications"
      :stats-by-application-id="applicationStatsById"
      @open="openApplicationDetail"
      @create="openCreateApplicationModal"
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

      <template v-else>
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

        <VibeControlSourceSetup
          :selected-application="selectedApplication"
          :source-connections="store.activeSourceConnections"
          :is-generating="store.isGenerating"
          @generate="store.runMockGeneration($event)"
          @persist="store.persistCurrentSnapshot()"
        />

        <VibeControlAgentRunCenter
          v-if="store.lastRunLog.length > 0"
          :logs="store.lastRunLog"
        />
      </template>
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
import type { DecodedVibeControlApplication } from "@models/vibeControl";
import type { VibeControlApplicationInput } from "@stores/vibeControl";

type VibeControlView = "applications" | "application-detail" | "story-detail";
type ApplicationDetailTab = "stories" | "basic";

type ApplicationStats = {
  storyCount: number;
  averageConfidence: number;
  needsReviewCount: number;
  highDriftCount: number;
};

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
const currentView = ref<VibeControlView>("applications");
const activeApplicationTab = ref<ApplicationDetailTab>("stories");
const applicationModalOpen = ref(false);
const deleteConfirmOpen = ref(false);
const editingApplicationId = ref<string | null>(null);

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
  if (currentView.value === "applications") {
    return "アプリ一覧";
  }
  if (currentView.value === "story-detail") {
    return selectedStory.value?.title ?? "ユーザーストーリー";
  }
  return activeApplicationTab.value === "basic"
    ? "アプリ詳細"
    : "ユーザーストーリー一覧";
});

const pageIcon = computed(() =>
  pageTitle.value.includes("ユーザーストーリー")
    ? "flat-color-icons:flow-chart"
    : "flat-color-icons:deployment"
);

const pageSubtitle = computed(() => {
  if (currentView.value === "applications") {
    return "ユーザーストーリーを束ねるアプリ単位を選択します";
  }
  if (currentView.value === "story-detail") {
    return selectedStory.value
      ? `${selectedStory.value.storyKey} / ${selectedStory.value.applicationKey}`
      : "ユーザーストーリーを確認します";
  }
  if (activeApplicationTab.value === "basic") {
    return selectedApplication.value
      ? `${selectedApplication.value.name} の基本情報とSSOT生成設定を管理します`
      : "アプリの基本情報とSSOT生成設定を管理します";
  }
  return selectedApplication.value
    ? `${selectedApplication.value.name} のユーザーストーリー一覧を管理します`
    : "アプリ詳細とユーザーストーリー一覧を管理します";
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
]);

const breadcrumbItems = computed(() => {
  const items: Array<{
    label: string;
    icon?: string;
    onClick?: () => void;
    disabled?: boolean;
  }> = [
    {
      label: "アプリ一覧",
      icon: "material-symbols:apps-outline",
      onClick: showApplicationList,
    },
  ];

  if (currentView.value !== "applications") {
    items.push({
      label: "アプリ詳細",
      onClick: showApplicationDetail,
    });
  }

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
      label: selectedApplication.value.name,
      disabled: true,
    });
  }

  return items;
});

const applicationStatsById = computed<Record<string, ApplicationStats>>(() => {
  const stats: Record<string, ApplicationStats> = {};
  for (const application of store.applications) {
    const stories = store.stories.filter(
      (story) => story.applicationId === application.id
    );
    stats[application.id] = {
      storyCount: stories.length,
      averageConfidence:
        stories.length === 0
          ? 0
          : Math.round(
              stories.reduce((sum, story) => sum + story.confidenceScore, 0) /
                stories.length
            ),
      needsReviewCount: stories.filter(
        (story) => story.reviewState === "needs_review"
      ).length,
      highDriftCount: stories.filter((story) => story.driftLevel === "high")
        .length,
    };
  }
  return stats;
});

onMounted(() => {
  applyRouteView();
  void store.fetchFromFirestore().then(() => {
    applyRouteView();
  });
});

watch(
  () => route.query.view,
  () => {
    applyRouteView();
  }
);

watch(activeApplicationTab, (tab) => {
  if (currentView.value !== "application-detail") return;
  updateViewQuery(tab === "basic" ? "application-detail" : "stories");
});

function routeView(): "applications" | "application-detail" | "stories" {
  if (route.query.view === "stories") return "stories";
  if (route.query.view === "application-detail") return "application-detail";
  return "applications";
}

function updateViewQuery(
  view: "applications" | "application-detail" | "stories"
): void {
  if (routeView() === view) return;
  void router.replace({
    query: {
      ...route.query,
      view,
    },
  });
}

function applyRouteView(): void {
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

  if (currentView.value !== "applications") {
    currentView.value = "applications";
  }
}

function showApplicationList(): void {
  currentView.value = "applications";
  updateViewQuery("applications");
}

function showApplicationDetail(): void {
  if (!selectedApplication.value && store.applications[0]) {
    store.selectApplication(store.applications[0].id);
  }
  activeApplicationTab.value = "stories";
  currentView.value = "application-detail";
  updateViewQuery("stories");
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
  applicationModalOpen.value = true;
}

function openEditApplicationModal(application?: DecodedVibeControlApplication): void {
  const target = application ?? selectedApplication.value;
  if (!target) return;
  editingApplicationId.value = target.id;
  applicationModalOpen.value = true;
}

async function saveApplication(input: VibeControlApplicationInput): Promise<void> {
  const application = await store.upsertApplication(input);
  applicationModalOpen.value = false;
  editingApplicationId.value = null;
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
  currentView.value = "applications";
  toast.add({
    title: "アプリケーションを削除しました",
    description: applicationName,
    color: "success",
  });
}
</script>
