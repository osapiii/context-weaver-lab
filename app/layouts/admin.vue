<template>
  <div>
    <EFullScreenLoading
      :active="globalLoading.isLoading"
      :message="globalLoading.loadingText"
    />

    <!-- 集中モード解除ボタン -->
    <Transition name="fade">
      <div
        v-show="context.focusModeIsActive"
        class="fixed top-4 left-1/2 -translate-x-1/2 z-50"
      >
        <UButton
          color="gray"
          size="sm"
          @click="context.toggleFocusMode()"
        >
          <UIcon :name="actionIcons.visibility" class="mr-2" />
          全画面表示を解除 (Esc)
        </UButton>
      </div>
    </Transition>

    <!-- ヘッダー：集中モード時は非表示 -->
    <Transition name="slide-down">
      <header
        v-show="!context.focusModeIsActive"
        class="fixed top-0 left-0 w-full z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-sm"
      >
        <div
          class="flex items-center justify-between gap-2 px-3 py-3 sm:gap-4 sm:px-6"
        >
          <div class="flex min-w-0 items-center gap-2 sm:gap-4">
            <button
              type="button"
              class="flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded transition-opacity hover:opacity-80"
              aria-label="ホームに戻る"
              title="ホームに戻る"
              @click="navigateToHome"
            >
              <NuxtImg
                v-if="appearance.hasCustomLogo.value"
                :src="appearance.logoUrl.value"
                alt="ロゴ"
                class="h-8 max-w-[160px] object-contain"
              />
              <span
                v-else
                class="text-xl font-bold text-white tracking-tight font-mono"
              >
                EN AIstudio
              </span>
            </button>
          </div>

          <div class="flex shrink-0 items-center gap-2.5">
            <HeaderBusinessConsultationShortcut />
            <GoogleWorkspaceConnectionHeaderChip />
            <GoogleDriveSyncGlobalIndicator />
            <ResearchAgentGlobalIndicator />
            <WorkflowExecutionGlobalIndicator />
          </div>
        </div>
      </header>
    </Transition>

    <!-- サイドバー + メインコンテンツ -->
    <div
      class="flex min-h-0 overflow-hidden"
      :class="[
        adminShellBgClass,
        context.focusModeIsActive
          ? 'mt-0 h-screen'
          : 'mt-16 h-[calc(100vh-4rem-1.75rem)]',
      ]"
    >
      <AdminModeActivitySidebar
        :grouped-nav-modes="groupedNavModes"
        :current-mode-key="currentModeKey"
        :collapsed="adminNavSidebarCollapsed"
        :focus-hidden="context.focusModeIsActive"
        @navigate="navigateToMode"
        @toggle="toggleAdminNavSidebar"
      />
      <div class="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <!-- EN AIstudio 統合アシスタント.
             側面 / 高さ / mode 別の色は EnAssistantSlideover + EnAssistantPanel 側で完結.
             初回 open まで mount しない (Lazy + v-if) — チャット履歴 / markdown render /
             streaming 処理を含む重いコンポーネントなので、idle ページでも reactive cost
             が乗らないように遅延ロード. -->
        <LazyEnAssistantSlideover v-if="hasOpenedAssistantOnce" />

        <!--
          メイン: 外枠は固定高さ、内側だけ overflow-y-auto。
          ページ root に min-h-screen / 100vh calc を置くと二重計上でゴーストスクロールになるため禁止。
        -->
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
    </div>

    <!--
      VSCode 風ステータスバー (フッター)。
      旧ヘッダー右側の補助機能 (ズーム / 全画面 / Space / ユーザー情報 / サインアウト) を
      ここに集約し、ヘッダーをスリムに保つ。
    -->
    <Transition name="slide-up">
      <footer
        v-show="!context.focusModeIsActive"
        class="fixed bottom-0 left-0 w-full z-20 h-7 bg-slate-900 border-t border-slate-800 text-xs text-slate-300 select-none"
      >
        <div class="flex items-center h-full px-3 gap-2">
          <!-- タブレット / 狭幅: Space 切替 + その他操作 (⋯) をドロップダウンに集約 -->
          <div class="flex items-center gap-1 xl:hidden">
            <button
              type="button"
              class="flex items-center gap-1 px-2 h-6 rounded text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
              @click="isSpaceModalOpen = true"
            >
              <UIcon :name="actionIcons.swap" class="w-4 h-4" />
              <span class="max-w-[8rem] truncate">
                {{ spaceStore.selectedSpace?.name ?? "スペース" }}
              </span>
            </button>
            <UDropdownMenu
              :items="footerMenuItems"
              :content="{ side: 'top', align: 'start' }"
            >
              <button
                type="button"
                class="flex items-center gap-1 px-2 h-6 rounded text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                aria-label="その他のメニュー"
              >
                <UIcon
                  name="i-heroicons-ellipsis-horizontal"
                  class="w-4 h-4"
                />
                <span>メニュー</span>
              </button>
            </UDropdownMenu>
          </div>

          <!-- PC: 従来どおりの横並びツールバー (タブレットでは上のメニューに集約) -->
          <div class="hidden xl:flex items-center gap-2">
          <!-- ブラウザ標準のページズーム (body zoom は使わない) -->
          <div class="flex items-center gap-0.5">
            <button
              type="button"
              class="flex items-center gap-1 px-2 h-5 rounded text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
              :title="`ブラウザの表示を縮小 (${browserZoom.modKey.value}+-)`"
              @click="browserZoom.zoomOut()"
            >
              <span>縮小</span>
              <span class="text-[10px] opacity-70">
                {{ browserZoom.modKey.value }}+-
              </span>
            </button>
            <button
              type="button"
              class="flex items-center gap-1 px-2 h-5 rounded text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
              :title="`ブラウザの表示を100%に戻す (${browserZoom.modKey.value}+0)`"
              @click="browserZoom.resetZoom()"
            >
              <span>100%</span>
              <span class="text-[10px] opacity-70">
                {{ browserZoom.modKey.value }}+0
              </span>
            </button>
            <button
              type="button"
              class="flex items-center gap-1 px-2 h-5 rounded text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
              :title="`ブラウザの表示を拡大 (${browserZoom.modKey.value}++)`"
              @click="browserZoom.zoomIn()"
            >
              <span>拡大</span>
              <span class="text-[10px] opacity-70">
                {{ browserZoom.modKey.value }}++
              </span>
            </button>
          </div>

          <span class="h-3 w-px bg-slate-700" />

          <!-- 全画面表示 -->
          <button
            class="flex items-center gap-1 px-2 h-5 rounded text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
            @click="context.toggleFocusMode()"
          >
            <UIcon name="i-heroicons-arrows-pointing-out" class="w-3 h-3" />
            <span>全画面表示</span>
            <span class="text-[10px] opacity-70">Esc</span>
          </button>

          <span class="h-3 w-px bg-slate-700" />

          <!-- Space 切替 -->
          <button
            class="flex items-center gap-1 px-2 h-5 rounded text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
            @click="isSpaceModalOpen = true"
          >
            <UIcon :name="actionIcons.swap" class="w-3 h-3" />
            <span>{{ spaceStore.selectedSpace?.name ?? "スペース" }}</span>
          </button>

          <span class="h-3 w-px bg-slate-700" />

          <!-- 設定 (VSCode 風に控えめにフッター配置。Ctrl/Cmd+, でも開ける) -->
          <button
            class="flex items-center gap-1 px-2 h-5 rounded text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
            :title="`設定 (${isMac ? '⌘' : 'Ctrl'}+,)`"
            @click="openPreferences"
          >
            <UIcon name="material-symbols:settings-outline" class="w-3 h-3" />
            <span>設定</span>
            <span class="text-[10px] opacity-70">
              {{ isMac ? "⌘" : "Ctrl" }}+,
            </span>
          </button>

          <span class="h-3 w-px bg-slate-700" />

          <NuxtLink
            :to="{ name: 'admin-help' }"
            class="flex items-center gap-1 px-2 h-5 rounded transition-colors"
            :class="
              isHelpPage
                ? 'bg-slate-800 text-slate-100'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            "
            title="EN AIstudio のヘルプセンターを開く"
          >
            <UIcon name="material-symbols:help-outline" class="w-3 h-3" />
            <span>ヘルプ</span>
          </NuxtLink>

          <span class="h-3 w-px bg-slate-700" />

          <!-- リクエストログ (管理者監査) -->
          <NuxtLink
            :to="{ name: 'admin-request-logs' }"
            class="flex items-center gap-1 px-2 h-5 rounded transition-colors"
            :class="
              isRequestLogsPage
                ? 'bg-slate-800 text-slate-100'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            "
            title="全 RequestDoc の実行履歴を確認"
          >
            <UIcon :name="fileIcons.requestLog" class="w-3 h-3" />
            <span>リクエストログ</span>
          </NuxtLink>

          <NuxtLink
            :to="{ name: 'admin-storage' }"
            class="flex items-center gap-1 px-2 h-5 rounded transition-colors"
            :class="
              isStoragePage
                ? 'bg-slate-800 text-slate-100'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            "
            title="Firebase Storage をブラウズ"
          >
            <UIcon name="i-heroicons-folder" class="w-3 h-3" />
            <span>ストレージ</span>
          </NuxtLink>
          </div>

          <!-- Spacer -->
          <div class="ml-auto flex items-center gap-2">
            <WebPageIngestGlobalIndicator />
            <!-- ユーザー情報 -->
            <div class="flex items-center gap-1.5">
              <UAvatar
                :alt="organization.loggedInOrganizationInfo.name"
                size="3xs"
                class="bg-slate-700 text-white"
              />
              <span class="font-semibold text-slate-100">
                {{ organization.loggedInOrganizationInfo.name }}
              </span>
              <span class="text-slate-500 hidden xl:inline">
                {{ adminUser.currentUserClaimsInfo.email }}
              </span>
            </div>

            <span class="h-3 w-px bg-slate-700 hidden xl:block" />

            <!-- サインアウト (タブレットでは ⋯ メニューに集約済み) -->
            <button
              class="hidden xl:flex items-center gap-1 px-2 h-5 rounded text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
              @click="auth.signOut"
            >
              <UIcon :name="actionIcons.logout" class="w-3 h-3" />
              <span>サインアウト</span>
            </button>
          </div>
        </div>
      </footer>
    </Transition>

    <!-- Space 選択モーダル -->
    <SpaceSelectModal v-model="isSpaceModalOpen" />

    <GoogleDriveImportDebugModal v-model:open="driveImportModalOpen" />
    <WebPageIngestProgressModal />
    <KnowledgePreviewModal />

    <!-- EN AIstudio 操作ガイド FAB (Cmd+/ で開く).
         リサーチエージェント画面では「やり直す」緑 fab と被るため非表示にする. -->
    <Transition name="fade">
      <EnAssistantFloatingButton
        v-show="
          !context.focusModeIsActive &&
          !isResearchAgentPage &&
          !isAiStudioImmersive
        "
      />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import AdminPageContainer from "@components/layout/AdminPageContainer.vue";
import GoogleDriveImportDebugModal from "@components/dataSource/GoogleDriveImportDebugModal.vue";
import AdminModeActivitySidebar from "@components/admin/AdminModeActivitySidebar.vue";
import { ADMIN_NAV_SIDEBAR_STORAGE_KEY } from "@constants/adminLayout";
import GoogleDriveSyncGlobalIndicator from "@components/GoogleDriveSyncGlobalIndicator.vue";
import WebPageIngestGlobalIndicator from "@components/WebPageIngestGlobalIndicator.vue";
import WebPageIngestProgressModal from "@components/dataSource/WebPageIngestProgressModal.vue";
import KnowledgePreviewModal from "@components/knowledge/KnowledgePreviewModal.vue";
import { useWebCrawlGlobalIngest } from "@composables/useWebCrawlGlobalIngest";
import HeaderBusinessConsultationShortcut from "@components/HeaderBusinessConsultationShortcut.vue";
import { useBusinessConsultationLauncher } from "@composables/useAiStudioLauncher";
import { useGoogleDriveGlobalSync } from "@composables/useGoogleDriveGlobalSync";
import {
  resolveAdminPageContainerVariant,
  resolveAdminPageFillHeight,
  useAdminPageContainerOverride,
} from "@composables/useAdminPageContainer";
import { clearLegacyAppZoom } from "@composables/useBrowserZoom";
import {
  ADMIN_PAGE_FILL_HEIGHT_KEY,
  type AdminPageContainerVariant,
} from "@composables/useAdminViewport";
//#region composables
const actionIcons = useActionIcons();
const fileIcons = useFileIcons();
const appearance = useAppAppearance();
// タブレット/タッチ判定: フッターのツールバー出し分け & サイドバー自動折りたたみに使う
const device = useDeviceType();
const { importProgressModalOpen: driveImportModalOpen } =
  useGoogleDriveGlobalSync();
useWebCrawlGlobalIngest();
const { openBusinessConsultation } = useBusinessConsultationLauncher();
//#endregion composables

//#region store
const router = useRouter();
const route = useRoute();
const auth = useAdminUserStore();
const organization = useOrganizationStore();
const adminUser = useAdminUserStore();
const context = useContextStore();
const globalLoading = useGlobalLoadingStore();
const spaceStore = useSpaceStore();
const geminiByok = useGeminiByokStore();
//#endregion store

onMounted(() => {
  void geminiByok.loadUserApiKey();
  try {
    const stored = localStorage.getItem(ADMIN_NAV_SIDEBAR_STORAGE_KEY);
    if (stored === null) {
      // 初回 (ユーザー未設定) はタブレット以下なら省スペースのためアイコンレールに畳む。
      // PC では従来どおり展開状態で開始する。
      adminNavSidebarCollapsed.value = device.isTabletOrBelow.value;
    } else {
      adminNavSidebarCollapsed.value = stored === "true";
    }
  } catch {
    // ignore
  }
});

//#region state
const browserZoom = useBrowserZoom();
const isSpaceModalOpen = ref(false);
const adminNavSidebarCollapsed = ref(false);

function toggleAdminNavSidebar(): void {
  adminNavSidebarCollapsed.value = !adminNavSidebarCollapsed.value;
  try {
    localStorage.setItem(
      ADMIN_NAV_SIDEBAR_STORAGE_KEY,
      String(adminNavSidebarCollapsed.value)
    );
  } catch {
    // private mode / quota exceeded
  }
}
const isMac = computed(() => {
  if (typeof navigator === "undefined") return false;
  return navigator.platform.toUpperCase().indexOf("MAC") >= 0;
});
const openPreferences = () => {
  router.push({ name: "admin-preferences" });
};

const isRequestLogsPage = computed(
  () => route.name === "admin-request-logs"
);
const isStoragePage = computed(() => route.name === "admin-storage");
const isHelpPage = computed(() => route.name === "admin-help");

/**
 * タブレット / 狭幅時のフッター "メニュー" (⋯) に畳み込む補助操作。
 * PC では横並びツールバーをそのまま表示するが、タブレットでは横幅が足りず
 * はみ出すため、二次的な操作をこのドロップダウンに集約する。
 * ブラウザズーム操作はタッチ端末ではネイティブのピンチズームがあるため省く。
 */
const footerMenuItems = computed(() => {
  const groups: Array<
    Array<{
      label: string;
      icon: string;
      kbds?: string[];
      onSelect: () => void;
    }>
  > = [];

  if (!device.isTouch.value) {
    groups.push([
      {
        label: "表示を縮小",
        icon: "i-heroicons-magnifying-glass-minus",
        onSelect: () => browserZoom.zoomOut(),
      },
      {
        label: "表示を 100% に戻す",
        icon: "i-heroicons-magnifying-glass",
        onSelect: () => browserZoom.resetZoom(),
      },
      {
        label: "表示を拡大",
        icon: "i-heroicons-magnifying-glass-plus",
        onSelect: () => browserZoom.zoomIn(),
      },
    ]);
  }

  groups.push([
    {
      label: "全画面表示",
      icon: "i-heroicons-arrows-pointing-out",
      onSelect: () => context.toggleFocusMode(),
    },
    {
      label: "設定",
      icon: "material-symbols:settings-outline",
      onSelect: () => openPreferences(),
    },
  ]);

  groups.push([
    {
      label: "ヘルプ",
      icon: "material-symbols:help-outline",
      onSelect: () => router.push({ name: "admin-help" }),
    },
    {
      label: "リクエストログ",
      icon: fileIcons.requestLog,
      onSelect: () => router.push({ name: "admin-request-logs" }),
    },
    {
      label: "ストレージ",
      icon: "i-heroicons-folder",
      onSelect: () => router.push({ name: "admin-storage" }),
    },
  ]);

  groups.push([
    {
      label: "サインアウト",
      icon: actionIcons.logout,
      onSelect: () => auth.signOut(),
    },
  ]);

  return groups;
});
// EN AIstudio 統合アシスタント: Space 切替時にチャット履歴を localStorage から復元
// (旧 operationAssistant の履歴があれば自動マイグレートも行う)
const enAiStudioAssistant = useEnAiStudioAssistantStore();
watch(
  () => spaceStore.selectedSpace?.id ?? null,
  (spaceId) => {
    enAiStudioAssistant.hydrateForSpace(spaceId);
  },
  { immediate: true }
);

/**
 * 初回 open を検知して Slideover を mount する flag.
 * idle ページで EnAssistantSlideover (チャット履歴 / markdown render /
 * streaming) を mount しっぱなしにすると reactive cost が乗るので、
 * Cmd+K or FAB クリックで初めて mount.
 */
const hasOpenedAssistantOnce = ref(false);
watch(
  () => enAiStudioAssistant.isOpen,
  (open) => {
    if (open) hasOpenedAssistantOnce.value = true;
  }
);
//#endregion state

//#region nav-modes
// モード Activity Bar: ホーム | 仕事をこなす / AI を育てる | データを見る・分析 / データを整える / データを連携する
// navGroup ごとに縦線で区切り、グループ内は配列順を維持する。
const { modes: navModes, findModeByRouteName } = useNavigationModeRegistry();

const routeName = computed(() => {
  const name = route.name;
  return typeof name === "string" ? name : "";
});

const currentMode = computed(() => findModeByRouteName(routeName.value));
const currentModeKey = computed(() => currentMode.value?.key);

/**
 * リボン描画用に navModes を navGroup でまとめる。
 * - グループ順 = そのグループが modes 配列で最初に登場した順 (例: home → ai → data)
 * - グループ内のモード順 = modes 配列の出現順
 * - 各モードに左から 1 始まりの shortcutKey を振る (Ctrl/Cmd + 数字)
 * これにより modes 配列内で grow が data 系より後にあっても、視覚的には ai グループに合流する。
 */
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

/** ショートカット番号 ("1"〜"6") → モード の逆引きマップ (Ctrl/Cmd + 数字) */
const modeByShortcut = computed(() => {
  const map = new Map<string, (typeof navModes)[number]>();
  for (const group of groupedNavModes.value) {
    for (const { mode, shortcutKey } of group.modes) {
      map.set(shortcutKey, mode);
    }
  }
  return map;
});

const navigateToMode = (mode: (typeof navModes)[number]) => {
  router.push({ name: mode.homeRouteName });
};

// EN AIstudio ロゴクリック → ホーム TOP に戻る
const navigateToHome = () => {
  const homeMode = navModes.find((m) => m.key === "home");
  if (homeMode) {
    router.push({ name: homeMode.homeRouteName });
  }
};

const isFacthubPage = computed(() => routeName.value === "admin-facthub");
const isResearchAgentPage = computed(
  () => routeName.value === "admin-research-agent"
);
const aiStudioStore = useAiStudioStore();
const isAiStudioImmersive = computed(
  () =>
    routeName.value === "admin-ai-studio" &&
    (!!aiStudioStore.sessionId || aiStudioStore.jobKind === "research")
);

const isAiStudioRoute = computed(
  () => routeName.value === "admin-ai-studio"
);

const isAiFeaturePage = computed(
  () =>
    routeName.value === "admin-data-source" ||
    routeName.value === "admin-request-logs" ||
    routeName.value === "admin-storage" ||
    (isAiStudioRoute.value && !isAiStudioImmersive.value)
);

const adminShellBgClass = computed(() => {
  if (isAiFeaturePage.value || isAiStudioImmersive.value) {
    return "bg-[#f1f5f3]";
  }
  return "bg-gray-50";
});

/** 余白なし・端まで使うルート (ページ側で provide 上書き可) */
const isAdminFlushRoute = computed(
  () =>
    isFacthubPage.value ||
    isResearchAgentPage.value ||
    isAiStudioImmersive.value
);

const adminPageContainerOverride = useAdminPageContainerOverride();

const adminPageRouteVariant = computed((): AdminPageContainerVariant => {
  if (isAdminFlushRoute.value) return "flush";
  if (isAiFeaturePage.value) return "ai";
  return "default";
});

const adminPageContainerVariant = computed(() =>
  resolveAdminPageContainerVariant({
    metaVariant: route.meta.adminPageContainer as
      | AdminPageContainerVariant
      | undefined,
    routeFallback: adminPageRouteVariant.value,
    override: adminPageContainerOverride?.value,
  })
);

const adminPageFillHeight = computed(() =>
  resolveAdminPageFillHeight({
    metaFillHeight: route.meta.adminPageFillHeight as boolean | undefined,
    routeFallback: isAdminFlushRoute.value,
    override: adminPageContainerOverride?.value,
  })
);

provide(ADMIN_PAGE_FILL_HEIGHT_KEY, adminPageFillHeight);

const adminPageStack = computed(
  () => (route.meta.adminPageStack as boolean | undefined) ?? true
);
//#endregion nav-modes

//#region event-handlers
const keydownHandler = (event: KeyboardEvent) => {
  // 入力フィールドやテキストエリア内では無効化
  const target = event.target as HTMLElement;
  if (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  ) {
    return;
  }

  // Esc: 集中モードを切り替える
  if (event.code === "Escape") {
    event.preventDefault();
    context.toggleFocusMode();
    return;
  }

  // Ctrl/Cmd + K で経営相談 (AIスタジオ) を起動
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    event.stopPropagation();
    void openBusinessConsultation();
    return;
  }

  // Ctrl/Cmd + , で 設定画面を開く (VSCode 風)
  if ((event.ctrlKey || event.metaKey) && event.key === ",") {
    event.preventDefault();
    event.stopPropagation();
    openPreferences();
    return;
  }

  // Ctrl/Cmd + 1〜4 でモード切替 (フッターの Ctrl+数字 と同じ修飾キー規約)
  if (
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    !event.shiftKey &&
    !event.isComposing
  ) {
    const codeMatch =
      event.code.match(/^Digit([1-6])$/) ??
      event.code.match(/^Numpad([1-6])$/);
    const digit = codeMatch?.[1] ?? (/^[1-6]$/.test(event.key) ? event.key : null);
    if (digit) {
      const mode = modeByShortcut.value.get(digit);
      if (mode) {
        event.preventDefault();
        event.stopPropagation();
        navigateToMode(mode);
        return;
      }
    }
  }

  // Ctrl/Cmd + 0/1/2/3 でズームレベル切り替え
  if (event.ctrlKey || event.metaKey) {
    // 0 キーで極小（50%）
    if (event.code === "Digit0" || event.code === "Numpad0" || event.key === "0") {
      event.preventDefault();
      event.stopPropagation();
      applyZoom(50);
      return;
    }
    // 1 キーで通常（100%）
    if (event.code === "Digit1" || event.code === "Numpad1" || event.key === "1") {
      event.preventDefault();
      event.stopPropagation();
      applyZoom(100);
      return;
    }
    // 2 キーで大（150%）
    if (event.code === "Digit2" || event.code === "Numpad2" || event.key === "2") {
      event.preventDefault();
      event.stopPropagation();
      applyZoom(150);
      return;
    }
    // 3 キーで極大（200%）
    if (event.code === "Digit3" || event.code === "Numpad3" || event.key === "3") {
      event.preventDefault();
      event.stopPropagation();
      applyZoom(200);
      return;
    }
  }
};

onMounted(() => {
  // キャプチャフェーズでイベントを処理して、他のハンドラーより先に実行
  window.addEventListener("keydown", keydownHandler, true);
  browserZoom.clearLegacyAppZoom();
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", keydownHandler, true);
  clearLegacyAppZoom();
});
//#endregion event-handlers
</script>

<style scoped>
/* ヘッダー：上からスライド */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease-in-out;
}

.slide-down-enter-from,
.slide-down-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}

.slide-down-enter-to,
.slide-down-leave-from {
  transform: translateY(0);
  opacity: 1;
}

/* フッター：下からスライド */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease-in-out;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

.slide-up-enter-to,
.slide-up-leave-from {
  transform: translateY(0);
  opacity: 1;
}

/* フェードアニメーション */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease-in-out;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
