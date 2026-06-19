<template>
  <div class="min-h-screen bg-slate-50 text-slate-900">
    <EFullScreenLoading
      :active="globalLoading.isLoading"
      :message="globalLoading.loadingText"
    />

    <header class="fixed left-0 top-0 z-30 w-full border-b border-slate-200 bg-white/95 backdrop-blur">
      <div class="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
        <div class="flex min-w-0 items-center gap-3">
          <button
            type="button"
            class="flex min-w-0 items-center gap-2 rounded-md text-left transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            aria-label="アプリ一覧へ"
            @click="navigateToVibeControl"
          >
            <NuxtImg
              v-if="appearance.hasCustomLogo.value"
              :src="appearance.logoUrl.value"
              alt="ロゴ"
              class="h-7 max-w-[160px] object-contain"
            />
            <span
              v-else
              class="truncate font-mono text-lg font-bold tracking-tight text-slate-950"
            >
              {{ currentMode?.label ?? "アプリ" }}
            </span>
          </button>

          <VibeControlApplicationHeader
            v-if="showVibeControlSwitcher"
            :applications="vibeControl.applications"
            :selected-application="vibeControl.selectedApplication"
            :show-create="false"
            :show-edit="false"
            @select="selectVibeControlApplication"
            @manage="navigateToVibeControl"
          />
        </div>

        <div class="flex min-w-0 shrink-0 items-center gap-2">
          <button
            type="button"
            class="hidden h-8 max-w-[14rem] items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 sm:flex"
            @click="isSpaceModalOpen = true"
          >
            <UIcon name="material-symbols:workspaces-outline-rounded" class="h-4 w-4" />
            <span class="truncate">
              {{ spaceStore.selectedSpace?.name ?? "スペース未選択" }}
            </span>
          </button>

          <div class="hidden min-w-0 items-center gap-2 rounded-md bg-slate-100 px-2 py-1 sm:flex">
            <UAvatar
              :alt="organization.loggedInOrganizationInfo.name || 'user'"
              size="2xs"
              class="bg-slate-700 text-white"
            />
            <span class="max-w-[12rem] truncate text-xs font-semibold text-slate-700">
              {{ adminUser.currentUserClaimsInfo.email }}
            </span>
          </div>

          <button
            type="button"
            class="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            @click="auth.signOut"
          >
            <UIcon :name="actionIcons.logout" class="h-4 w-4" />
            <span class="hidden sm:inline">サインアウト</span>
          </button>
        </div>
      </div>
    </header>

    <div class="mt-14 flex h-[calc(100vh-3.5rem-1.75rem)] min-h-0 overflow-hidden bg-slate-50">
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
          class="flex h-5 items-center gap-1 rounded px-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
        >
          <UIcon name="material-symbols:flowchart-rounded" class="h-3.5 w-3.5" />
          <span>仕事ログ</span>
        </NuxtLink>

        <div class="ml-auto flex min-w-0 items-center gap-2">
          <span class="hidden truncate text-slate-500 sm:inline">
            {{ organization.loggedInOrganizationInfo.name }}
          </span>
          <span class="hidden h-3 w-px bg-slate-700 sm:block" />
          <span class="max-w-[16rem] truncate font-semibold text-slate-100">
            {{ adminUser.currentUserClaimsInfo.email }}
          </span>
        </div>
      </div>
    </footer>

    <SpaceSelectModal v-model="isSpaceModalOpen" />
  </div>
</template>

<script setup lang="ts">
import AdminModeActivitySidebar from "@components/admin/AdminModeActivitySidebar.vue";
import AdminPageContainer from "@components/layout/AdminPageContainer.vue";
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

const actionIcons = useActionIcons();
const appearance = useAppAppearance();
const router = useRouter();
const route = useRoute();
const auth = useAdminUserStore();
const adminUser = useAdminUserStore();
const organization = useOrganizationStore();
const globalLoading = useGlobalLoadingStore();
const spaceStore = useSpaceStore();
const vibeControl = useVibeControlStore();

const isSpaceModalOpen = ref(false);
const adminNavSidebarCollapsed = ref(false);

function navigateToVibeControl(): void {
  void router.push({
    name: "admin-vibe-control",
    query: { view: "applications" },
  });
}

onMounted(() => {
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

const currentMode = computed(() => {
  if (routeName.value === "admin-vibe-control") {
    const view = typeof route.query.view === "string" ? route.query.view : "";
    return navModes.find((mode) =>
      view === "stories"
        ? mode.key === "stories"
        : mode.key === "applications"
    );
  }
  return findModeByRouteName(routeName.value);
});

useHead({
  title: () => currentMode.value?.label ?? "アプリ",
});

const currentModeKey = computed(() => currentMode.value?.key);
const showVibeControlSwitcher = computed(
  () => routeName.value === "admin-vibe-control"
);

function selectVibeControlApplication(applicationId: string): void {
  vibeControl.selectApplication(applicationId);
  void router.push({
    name: "admin-vibe-control",
    query: { view: "stories" },
  });
}

const groupedNavModes = computed(() => {
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
  return Array.from(groupMap.entries()).map(([id, modes]) => ({
    id,
    modes: modes.map((mode) => ({
      mode,
      shortcutKey: String(++runningIdx),
    })),
  }));
});

function navigateToMode(mode: (typeof navModes)[number]): void {
  void router.push({
    name: mode.homeRouteName,
    query: mode.homeRouteQuery,
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
