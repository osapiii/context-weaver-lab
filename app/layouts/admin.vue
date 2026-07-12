<template>
  <div class="min-h-screen bg-slate-50 text-slate-900">
    <EFullScreenLoading
      :active="globalLoading.isLoading && !suppressGlobalLoadingForVideoEditor"
      :message="globalLoading.loadingText"
    />

    <header
      v-if="!hideAdminHeaderForVideoEditor"
      class="fixed left-0 top-0 z-30 w-full border-b border-slate-200 bg-white/95 backdrop-blur"
    >
      <div class="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
        <div class="flex min-w-0 items-center gap-3">
          <button
            type="button"
            class="flex min-w-0 items-center gap-2 rounded-md text-left transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            aria-label="StoryVault ホームへ"
            @click="navigateToStoryVault"
          >
            <img
              src="/storyvault-logo.svg"
              alt="StoryVault"
              class="h-10 w-[205px] object-contain"
            >
          </button>

          <StoryVaultApplicationHeader
            v-if="showStoryVaultSwitcher"
            :applications="storyVault.applications"
            :selected-application="storyVault.selectedApplication"
            :show-create="false"
            :show-edit="false"
            @select="selectStoryVaultApplication"
            @manage="isApplicationManagerOpen = true"
          />
        </div>

        <div class="flex min-w-0 shrink-0 items-center gap-2">
          <GoogleWorkspaceConnectionHeaderChip />
          <StoryVaultMcpConnectionHeaderChip />
          <StoryVaultClipPipelineStatus />
          <GoogleDriveSyncGlobalIndicator />
          <WorkflowExecutionGlobalIndicator />
        </div>
      </div>
    </header>

    <div
      :class="[
        'flex min-h-0 overflow-hidden bg-slate-50',
        hideAdminHeaderForVideoEditor
          ? 'h-[calc(100vh-1.75rem)]'
          : 'mt-14 h-[calc(100vh-3.5rem-1.75rem)]',
      ]"
    >
      <AdminModeActivitySidebar
        :grouped-nav-modes="groupedNavModes"
        :current-mode-key="currentModeKey"
        :collapsed="adminNavSidebarCollapsed"
        @navigate="navigateToMode"
        @toggle="toggleAdminNavSidebar"
      />

      <main class="relative z-10 flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div
          :class="[
            'flex min-h-0 w-full min-w-0 flex-1 flex-col transition-all duration-300 ease-in-out',
            adminPageFillHeight ? 'overflow-hidden' : 'overflow-y-auto',
          ]"
        >
          <AdminPageContainer
            :variant="adminPageContainerVariant"
            :fill-height="adminPageFillHeight"
            :stack="adminPageStack"
          >
            <slot />
          </AdminPageContainer>
        </div>
      </main>
    </div>

    <footer class="fixed bottom-0 left-0 z-30 h-7 w-full border-t border-slate-800 bg-slate-900 text-xs text-slate-300">
      <div class="flex h-full min-w-0 items-center gap-2 px-3">
        <button
          type="button"
          class="flex h-5 items-center gap-1 rounded px-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
          @click="isSpaceModalOpen = true"
        >
          <UIcon name="material-symbols:workspaces-outline-rounded" class="h-3.5 w-3.5" />
          <span class="max-w-[12rem] truncate">
            {{ spaceStore.selectedSpace?.name ?? "スペース未選択" }}
          </span>
        </button>

        <NuxtLink
          :to="{ name: 'admin-preferences' }"
          class="flex h-5 items-center gap-1 rounded px-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
        >
          <UIcon name="material-symbols:settings-outline" class="h-3.5 w-3.5" />
          <span>設定</span>
        </NuxtLink>

        <NuxtLink
          :to="{ name: 'admin-workflow-executions' }"
          class="flex h-5 items-center gap-1 rounded px-2 transition-colors"
          :class="
            isWorkflowExecutionsPage || hasRunningWorkflowExecutions
              ? 'bg-slate-800 text-slate-100'
              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
          "
          title="実行中・完了した AI / Workflow ジョブを確認"
        >
          <UIcon
            :name="
              hasRunningWorkflowExecutions
                ? 'material-symbols:autorenew'
                : 'material-symbols:flowchart-rounded'
            "
            class="h-3.5 w-3.5"
            :class="hasRunningWorkflowExecutions ? 'animate-spin text-orange-400' : ''"
          />
          <span>仕事ログ</span>
          <span
            v-if="hasRunningWorkflowExecutions"
            class="ml-0.5 rounded bg-orange-500 px-1 text-[10px] font-bold leading-4 text-white"
          >
            {{ workflowExecutions.runningCount }}
          </span>
        </NuxtLink>

        <div class="ml-auto flex min-w-0 items-center gap-2">
          <span class="hidden truncate text-slate-500 sm:inline">
            {{ organization.loggedInOrganizationInfo.name }}
          </span>
          <button
            type="button"
            class="flex h-5 items-center gap-1 rounded px-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
            @click="auth.signOut"
          >
            <UIcon :name="actionIcons.logout" class="h-3.5 w-3.5" />
            <span>サインアウト</span>
          </button>
        </div>
      </div>
    </footer>

    <EnModal
      v-model:open="isApplicationManagerOpen"
      title="アプリ一覧を管理"
      title-icon="material-symbols:apps-outline"
      size="full"
      :ui="{ content: 'sm:max-w-5xl' }"
    >
      <StoryVaultApplicationList
        :applications="storyVault.applications"
        :stats-by-application-id="applicationStatsById"
        @open="openManagedApplication"
        @create="openCreateApplication"
        @open-repositories="openRepositoryList"
      />
    </EnModal>

    <SpaceSelectModal v-model="isSpaceModalOpen" />
    <LazyNotificationSlideover v-if="notifications.isPanelOpen" />
    <GoogleDriveImportProgressModal />
    <LazyWorkflowNotificationPet
      v-if="mountWorkflowNotificationPet"
      v-show="!context.focusModeIsActive"
    />
  </div>
</template>

<script setup lang="ts">
import AdminModeActivitySidebar from "@components/admin/AdminModeActivitySidebar.vue";
import GoogleDriveImportProgressModal from "@components/dataSource/GoogleDriveImportProgressModal.vue";
import GoogleDriveSyncGlobalIndicator from "@components/GoogleDriveSyncGlobalIndicator.vue";
import GoogleWorkspaceConnectionHeaderChip from "@components/GoogleWorkspaceConnectionHeaderChip.vue";
import AdminPageContainer from "@components/layout/AdminPageContainer.vue";
import StoryVaultMcpConnectionHeaderChip from "@components/StoryVaultMcpConnectionHeaderChip.vue";
import { ADMIN_NAV_SIDEBAR_STORAGE_KEY } from "@constants/adminLayout";
import {
  resolveAdminPageContainerVariant,
  resolveAdminPageFillHeight,
  useAdminPageContainerOverride,
} from "@composables/useAdminPageContainer";
import {
  ADMIN_PAGE_FILL_HEIGHT_KEY,
  type AdminPageContainerVariant,
} from "@composables/useAdminViewport";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
} from "@constants/siteSeo";

const actionIcons = useActionIcons();
const context = useContextStore();
const router = useRouter();
const route = useRoute();
const auth = useAdminUserStore();
const organization = useOrganizationStore();
const globalLoading = useGlobalLoadingStore();
const spaceStore = useSpaceStore();
const storyVault = useStoryVaultStore();
const videoStudio = useVideoStudioStore();
const workflowExecutions = useWorkflowExecutionsStore();
const notifications = useWorkflowNotificationsStore();

defineOptions({
  name: "AdminLayout",
});

const isSpaceModalOpen = ref(false);
const isApplicationManagerOpen = ref(false);
const adminNavSidebarCollapsed = ref(false);
const mountWorkflowNotificationPet = ref(false);

function navigateToStoryVault(): void {
  const query: Record<string, string> = { view: "application-knowledge" };
  if (storyVault.selectedApplicationId) {
    query.applicationId = storyVault.selectedApplicationId;
  }
  void router.push({
    name: "admin-storyvault",
    query,
  });
}

onMounted(() => {
  const mountNotificationUi = () => {
    mountWorkflowNotificationPet.value = true;
  };
  const requestIdle = window.requestIdleCallback;
  if (requestIdle) {
    requestIdle(mountNotificationUi, { timeout: 1200 });
  } else {
    window.setTimeout(mountNotificationUi, 0);
  }
  try {
    const stored = localStorage.getItem(ADMIN_NAV_SIDEBAR_STORAGE_KEY);
    adminNavSidebarCollapsed.value = stored === "true";
  } catch {
    adminNavSidebarCollapsed.value = false;
  }
});

function toggleAdminNavSidebar(): void {
  adminNavSidebarCollapsed.value = !adminNavSidebarCollapsed.value;
  try {
    localStorage.setItem(
      ADMIN_NAV_SIDEBAR_STORAGE_KEY,
      String(adminNavSidebarCollapsed.value)
    );
  } catch {
    // Ignore storage failures in private mode or restricted webviews.
  }
}

const { modes: navModes, findModeByRouteName } = useNavigationModeRegistry();

const routeName = computed(() => {
  const name = route.name;
  return typeof name === "string" ? name : "";
});

const isStoryVaultRoute = computed(() =>
  routeName.value.startsWith("admin-storyvault")
);
const shouldShowStoryVaultSwitcherRoute = computed(
  () =>
    isStoryVaultRoute.value ||
    routeName.value === "admin-preferences" ||
    routeName.value === "admin-settings"
);

const currentMode = computed(() => {
  if (isStoryVaultRoute.value) {
    const view = typeof route.query.view === "string" ? route.query.view : "";
    const modeKeyByView: Record<string, (typeof navModes)[number]["key"]> = {
      "application-knowledge": "knowledge",
      "application-knowledge-space": "knowledge",
      "application-zapping": "operation-videos",
      "application-videos": "operation-videos",
      "application-external-services": "settings",
      "application-git": "settings",
      "application-screen-catalog": "stories",
      "application-scan": "stories",
      "application-capabilities": "stories",
      stories: "stories",
      repositories: "git-repositories",
      "application-detail": "settings",
    };
    return navModes.find((mode) => mode.key === (modeKeyByView[view] ?? "knowledge"));
  }
  return findModeByRouteName(routeName.value);
});

useHead({
  title: () => currentMode.value?.label ?? "StoryVault",
});

useSeoMeta({
  description: () => currentMode.value?.subtitle ?? SITE_DESCRIPTION,
  ogTitle: () =>
    currentMode.value?.label
      ? `${currentMode.value.label} | ${SITE_NAME}`
      : SITE_NAME,
  ogDescription: () => currentMode.value?.subtitle ?? SITE_DESCRIPTION,
  twitterTitle: () =>
    currentMode.value?.label
      ? `${currentMode.value.label} | ${SITE_NAME}`
      : SITE_NAME,
  twitterDescription: () => currentMode.value?.subtitle ?? SITE_DESCRIPTION,
});

const currentModeKey = computed(() => currentMode.value?.key);
const showStoryVaultSwitcher = computed(() => shouldShowStoryVaultSwitcherRoute.value);
const suppressGlobalLoadingForVideoEditor = computed(
  () => isStoryVaultRoute.value && videoStudio.view === "editor"
);
const hideAdminHeaderForVideoEditor = computed(
  () =>
    isStoryVaultRoute.value &&
    videoStudio.view === "editor" &&
    Boolean(videoStudio.selectedProject)
);
const isWorkflowExecutionsPage = computed(
  () => routeName.value === "admin-workflow-executions"
);
const hasRunningWorkflowExecutions = computed(
  () => workflowExecutions.runningCount > 0
);

function selectStoryVaultApplication(applicationId: string): void {
  storyVault.selectApplication(applicationId);
  if (!isStoryVaultRoute.value) return;
  const currentView =
    typeof route.query.view === "string" ? route.query.view : "stories";
  void router.push({
    name: "admin-storyvault",
    query: { view: currentView },
  });
}

const applicationStatsById = computed(() => {
  const stats: Record<string, {
    storyCount: number;
    averageConfidence: number;
    needsReviewCount: number;
    highDriftCount: number;
  }> = {};
  for (const application of storyVault.applications) {
    const stories = storyVault.stories.filter(
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

function openManagedApplication(applicationId: string): void {
  isApplicationManagerOpen.value = false;
  selectStoryVaultApplication(applicationId);
}

function openCreateApplication(): void {
  isApplicationManagerOpen.value = false;
  void router.push({
    name: "admin-storyvault",
    query: { view: "application-knowledge", action: "create-app" },
  });
}

function openRepositoryList(): void {
  isApplicationManagerOpen.value = false;
  void router.push({
    name: "admin-storyvault",
    query: { view: "repositories" },
  });
}

const groupedNavModes = computed(() => {
  const groupOrder = ["input", "admin"];
  const groupMap = new Map<string, typeof navModes>();
  for (const mode of navModes) {
    const list = groupMap.get(mode.navGroup);
    if (list) {
      list.push(mode);
    } else {
      groupMap.set(mode.navGroup, [mode]);
    }
  }
  let runningIdx = 0;
  return groupOrder
    .filter((id) => groupMap.has(id))
    .map((id) => ({
    id,
    modes: (groupMap.get(id) ?? []).map((mode) => ({
      mode,
      shortcutKey: String(++runningIdx),
    })),
  }));
});

function navigateToMode(mode: (typeof navModes)[number]): void {
  const query: Record<string, string> = { ...(mode.homeRouteQuery ?? {}) };
  if (mode.homeRouteName === "admin-storyvault" && storyVault.selectedApplicationId) {
    query.applicationId = storyVault.selectedApplicationId;
  }
  void router.push({
    name: mode.homeRouteName,
    query,
  });
}

const adminPageContainerOverride = useAdminPageContainerOverride();

const adminPageContainerVariant = computed(() =>
  resolveAdminPageContainerVariant({
    metaVariant: route.meta.adminPageContainer as
      | AdminPageContainerVariant
      | undefined,
    routeFallback: "default",
    override: adminPageContainerOverride?.value,
  })
);

const adminPageFillHeight = computed(() =>
  resolveAdminPageFillHeight({
    metaFillHeight: route.meta.adminPageFillHeight as boolean | undefined,
    routeFallback: false,
    override: adminPageContainerOverride?.value,
  })
);

provide(ADMIN_PAGE_FILL_HEIGHT_KEY, adminPageFillHeight);

const adminPageStack = computed(
  () => (route.meta.adminPageStack as boolean | undefined) ?? true
);
</script>
