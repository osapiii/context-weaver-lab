<template>
  <div :class="pageShellClass">
    <VibeControlApplicationFormModal
      v-model:open="applicationModalOpen"
      :application="editingApplication"
      :initial-repository="initialApplicationRepository"
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

    <EnModal
      v-model:open="zappingAnalysisModalOpen"
      title="ザッピング動画を解析中"
      subtitle="動画・文字起こし・アプリ専用ナレッジを照合しています"
      title-icon="material-symbols:psychology-outline"
      size="full"
      :ui="{ content: 'w-[92vw] max-w-[1560px]' }"
      :hide-close="activeZappingAnalysisVideo?.analysisStatus === 'queued' || activeZappingAnalysisVideo?.analysisStatus === 'running'"
      :close-on-backdrop="activeZappingAnalysisVideo?.analysisStatus !== 'queued' && activeZappingAnalysisVideo?.analysisStatus !== 'running'"
    >
      <div class="space-y-5">
        <div
          class="overflow-hidden rounded-xl border"
          :class="activeZappingAnalysisVideo?.analysisStatus === 'error' ? 'border-red-200 bg-red-50' : activeZappingAnalysisVideo?.analysisStatus === 'completed' ? 'border-emerald-200 bg-emerald-50' : 'border-cyan-100 bg-cyan-50'"
        >
          <div class="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div class="flex min-w-0 items-start gap-3">
              <span
                class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                :class="activeZappingAnalysisVideo?.analysisStatus === 'error' ? 'bg-red-100 text-red-600' : activeZappingAnalysisVideo?.analysisStatus === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-cyan-700 shadow-sm ring-1 ring-cyan-100'"
              >
                <UIcon
                  :name="activeZappingAnalysisVideo?.analysisStatus === 'error' ? 'material-symbols:error-outline' : activeZappingAnalysisVideo?.analysisStatus === 'completed' ? 'material-symbols:check-circle-outline' : 'material-symbols:psychology-outline'"
                  class="h-6 w-6"
                />
              </span>
              <div class="min-w-0">
                <p class="truncate text-base font-black text-slate-950">
                  {{ activeZappingAnalysisVideo?.title || "ザッピング動画" }}
                </p>
                <p class="mt-1 text-sm leading-relaxed text-slate-600">
                  {{ zappingAnalysisProgressLabel }}
                </p>
                <p class="mt-2 truncate font-mono text-[11px] text-slate-500">
                  {{ activeZappingAnalysisRequestId || activeZappingAnalysisVideo?.analysisRequestId || "解析ジョブを準備中" }}
                </p>
              </div>
            </div>
            <div class="min-w-[220px] rounded-lg bg-white/80 p-3 ring-1 ring-white">
              <div class="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-slate-400">
                <span>ストーリー抽出</span>
                <span>{{ zappingAnalysisProgressPercent }}%</span>
              </div>
              <UProgress
                class="mt-2"
                :model-value="zappingAnalysisProgressPercent"
                :color="activeZappingAnalysisVideo?.analysisStatus === 'error' ? 'error' : activeZappingAnalysisVideo?.analysisStatus === 'completed' ? 'success' : 'primary'"
              />
            </div>
          </div>
        </div>

        <div class="grid gap-5 2xl:grid-cols-[minmax(390px,0.78fr)_minmax(680px,1.22fr)]">
          <ol class="space-y-2">
            <li
              v-for="step in zappingAnalysisSteps"
              :key="step.key"
              class="flex items-start gap-3 rounded-xl border bg-white px-3 py-3 transition"
              :class="step.status === 'active' ? 'border-cyan-200 shadow-sm shadow-cyan-100' : step.status === 'done' ? 'border-emerald-100' : step.status === 'error' ? 'border-red-200 bg-red-50' : 'border-slate-200'"
            >
              <span
                class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                :class="step.status === 'done' ? 'bg-emerald-100 text-emerald-700' : step.status === 'active' ? 'bg-cyan-100 text-cyan-700' : step.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-400'"
              >
                <UIcon
                  v-if="step.status === 'done'"
                  name="material-symbols:check-small"
                  class="h-5 w-5"
                />
                <UIcon
                  v-else-if="step.status === 'active'"
                  name="material-symbols:progress-activity"
                  class="h-5 w-5 animate-spin"
                />
                <UIcon
                  v-else-if="step.status === 'error'"
                  name="material-symbols:close-small"
                  class="h-5 w-5"
                />
                <span v-else>{{ step.index }}</span>
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-3">
                  <p class="text-sm font-bold text-slate-900">{{ step.label }}</p>
                  <span
                    class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                    :class="step.status === 'done' ? 'bg-emerald-50 text-emerald-700' : step.status === 'active' ? 'bg-cyan-50 text-cyan-700' : step.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-slate-50 text-slate-400'"
                  >
                    {{ step.statusLabel }}
                  </span>
                </div>
                <p class="mt-1 text-xs leading-relaxed text-slate-500">
                  {{ step.description }}
                </p>
              </div>
            </li>
          </ol>

          <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-start gap-3">
                <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-950 text-white">
                  <UIcon name="material-symbols:conversion-path-outline" class="h-5 w-5" />
                </span>
                <div class="min-w-0">
                  <p class="text-sm font-bold text-slate-950">
                    {{ zappingAnalysisInsight.heading }}
                  </p>
                  <p class="mt-1 text-xs leading-relaxed text-slate-500">
                    {{ zappingAnalysisInsight.subheading }}
                  </p>
                </div>
              </div>
              <span class="rounded-full bg-cyan-50 px-2.5 py-1 text-[11px] font-bold text-cyan-700">
                {{ zappingAnalysisInsight.badge }}
              </span>
            </div>

            <div class="mt-4 grid gap-3 md:grid-cols-3">
              <div class="rounded-lg bg-slate-50 p-3">
                <p class="text-[11px] font-bold text-slate-400">スクリーンショット</p>
                <p class="mt-1 text-xl font-black text-slate-950">{{ zappingAnalysisStats.frameCount }}</p>
              </div>
              <div class="rounded-lg bg-slate-50 p-3">
                <p class="text-[11px] font-bold text-slate-400">文字起こし</p>
                <p class="mt-1 text-xl font-black text-slate-950">{{ zappingAnalysisStats.transcriptChars }}</p>
              </div>
              <div class="rounded-lg bg-slate-50 p-3">
                <p class="text-[11px] font-bold text-slate-400">候補</p>
                <p class="mt-1 text-xl font-black text-slate-950">{{ zappingAnalysisStats.storyCount }}</p>
              </div>
            </div>

            <div class="mt-4 space-y-3">
              <div class="rounded-lg border border-slate-200 p-3">
                <div class="mb-3 flex items-center justify-between">
                  <p class="text-xs font-bold text-slate-500">読み取り中の内容</p>
                  <UIcon name="material-symbols:neurology-outline" class="h-4 w-4 text-cyan-600" />
                </div>
                <template v-if="zappingAnalysisInsight.lines.length > 0">
                  <div class="space-y-2">
                    <p
                      v-for="line in zappingAnalysisInsight.lines"
                      :key="line"
                      class="rounded-md bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-700"
                    >
                      {{ line }}
                    </p>
                  </div>
                </template>
                <template v-else>
                  <div class="space-y-2">
                    <div class="h-3 w-11/12 animate-pulse rounded-full bg-slate-100" />
                    <div class="h-3 w-8/12 animate-pulse rounded-full bg-slate-100" />
                    <div class="h-3 w-10/12 animate-pulse rounded-full bg-slate-100" />
                  </div>
                </template>
              </div>

              <div class="grid gap-3 xl:grid-cols-[0.95fr_1.05fr]">
                <div class="rounded-lg border border-slate-200 p-3">
                  <p class="mb-3 text-xs font-bold text-slate-500">解析に使っている根拠</p>
                  <div class="space-y-2">
                    <div
                      v-for="item in zappingAnalysisInsight.inputs"
                      :key="item.label"
                      class="flex items-start gap-2 rounded-md bg-slate-50 p-2"
                    >
                      <UIcon :name="item.icon" class="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
                      <div class="min-w-0">
                        <p class="text-[11px] font-bold text-slate-500">{{ item.label }}</p>
                        <p class="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-700">{{ item.value }}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="rounded-lg border border-slate-200 p-3">
                  <p class="mb-3 text-xs font-bold text-slate-500">見つかりそうな候補</p>
                  <div
                    v-if="zappingAnalysisStoryPreview.length > 0"
                    class="space-y-2"
                  >
                    <div
                      v-for="story in zappingAnalysisStoryPreview"
                      :key="story.id || story.title"
                      class="rounded-md bg-slate-50 p-2"
                    >
                      <p class="line-clamp-1 text-xs font-bold text-slate-800">{{ story.title }}</p>
                      <p class="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500">{{ story.goal || story.summary || story.userStory || story.benefit || "候補の詳細を整理しています。" }}</p>
                    </div>
                  </div>
                  <div
                    v-else
                    class="space-y-2"
                  >
                    <div class="h-12 animate-pulse rounded-md bg-slate-100" />
                    <div class="h-12 animate-pulse rounded-md bg-slate-100" />
                    <div class="h-12 animate-pulse rounded-md bg-slate-100" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <EnAlert
          v-if="activeZappingAnalysisVideo?.analysisErrorMessage"
          color="error"
          :title="activeZappingAnalysisVideo.analysisErrorMessage"
        />
      </div>

      <template #footer>
        <EnButton
          variant="outline"
          color="neutral"
          size="sm"
          :disabled="activeZappingAnalysisVideo?.analysisStatus === 'queued' || activeZappingAnalysisVideo?.analysisStatus === 'running'"
          @click="zappingAnalysisModalOpen = false"
        >
          閉じる
        </EnButton>
        <EnButton
          v-if="activeZappingAnalysisVideo?.analysisStatus === 'completed'"
          variant="ai"
          size="sm"
          leading-icon="material-symbols:visibility-outline"
          @click="openAnalyzedZappingVideo"
        >
          詳細を見る
        </EnButton>
      </template>
    </EnModal>

    <EnModal
      v-model:open="zappingAnalysisRerunConfirmOpen"
      title="解析結果を作り直しますか?"
      subtitle="既存のストーリー候補が新しい解析結果で置き換わります。"
      header-variant="warning"
      title-icon="material-symbols:warning-outline"
      size="md"
    >
      <div class="space-y-3">
        <div
          v-if="zappingAnalysisRerunTargetVideo"
          class="rounded-lg border border-amber-100 bg-amber-50 p-3"
        >
          <p class="text-sm font-semibold text-slate-950">
            {{ zappingAnalysisRerunTargetVideo.title || "ザッピング動画" }}
          </p>
          <p class="mt-1 text-xs leading-relaxed text-slate-600">
            現在の解析結果には {{ zappingAnalysisRerunStoryCount }} 件のストーリー候補があります。
          </p>
        </div>
        <p class="text-sm leading-relaxed text-slate-700">
          再解析すると、操作意図・ストーリー候補・根拠シーンが新しい結果で上書きされます。前回と内容が変わり、確認済みの内容と差分が出る場合があります。
        </p>
      </div>

      <template #footer>
        <EnButton
          variant="ghost"
          color="neutral"
          size="sm"
          @click="cancelZappingAnalysisRerun"
        >
          キャンセル
        </EnButton>
        <EnButton
          variant="soft"
          color="warning"
          size="sm"
          leading-icon="material-symbols:refresh"
          @click="confirmZappingAnalysisRerun"
        >
          上書きして再解析
        </EnButton>
      </template>
    </EnModal>

    <UBreadcrumb
      v-if="currentView !== 'application-detail'"
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
      v-if="showPageHeader"
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
      <template v-if="activeApplicationTab === 'stories'">
        <VibeControlVideoStoryCurationList
          :application-id="selectedApplication?.id"
          :videos="store.activeOperationVideos"
        />
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

        <VibeControlSourceSetup
          :selected-application="selectedApplication"
          :source-connections="store.activeSourceConnections"
          @persist="store.persistCurrentSnapshot()"
        />
      </template>

      <VibeControlApplicationScanResultsPanel
        v-else-if="activeApplicationTab === 'screen-catalog'"
        :application="selectedApplication"
        :run="selectedApplication?.lastScan ?? null"
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
        v-else-if="activeApplicationTab === 'zapping'"
        :application="selectedApplication"
        :videos="store.activeOperationVideos"
        :operation-video-groups="store.activeOperationVideoGroups"
        :is-saving="store.isSavingOperationVideo"
        :is-analyzing="store.isAnalyzingZappingVideos"
        :is-fetching-related-contexts="store.isFetchingRelatedContexts"
        :is-provisioning-file-space="store.isProvisioningApplicationFileSpace"
        @create-file-space="provisionSelectedApplicationFileSpace"
        @analyze="startZappingVideoAnalysis"
        @fetch-related-context="startRelatedContextAnalysis"
        @save="saveOperationVideo"
        @append-clip="appendOperationVideoClip"
        @update-clip-analysis="updateOperationVideoClipAnalysis"
        @create-group="createOperationVideoGroup"
        @update-group="updateOperationVideoGroup"
        @delete-group="deleteOperationVideoGroup"
        @apply-organization-plan="applyOperationVideoOrganizationPlan"
        @update-title="updateOperationVideoTitle"
        @delete-clip="deleteOperationVideoClip"
        @delete="deleteOperationVideo"
        @refresh="store.fetchFromFirestore()"
      />

      <VibeControlExternalServicesPanel
        v-else-if="activeApplicationTab === 'external-services'"
        :application="selectedApplication"
      />
    </template>

    <template v-else>
      <VibeControlStoryDetail
        :application="selectedApplication"
        :story="selectedStory"
        :evidence="store.selectedEvidence"
        :source-assets="store.activeSourceAssets"
        :operation-videos="store.activeOperationVideos"
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
import type {
  DecodedVibeControlApplication,
  DecodedVibeControlOperationVideo,
} from "@models/vibeControl";
import type { Document } from "@models/geminiFileSpaceRequest";
import type {
  VibeControlApplicationInput,
  VibeControlGenerationInput,
  VibeControlOperationVideoAppendInput,
  VibeControlOperationVideoClipAnalysisInput,
  VibeControlOperationVideoSaveInput,
} from "@stores/vibeControl";
import type { GitHubRepositorySummary } from "@composables/useGitHubOAuth";

type VibeControlView =
  | "repositories"
  | "application-detail"
  | "story-detail";
type ApplicationDetailTab =
  | "basic"
  | "knowledge-space"
  | "zapping"
  | "screen-catalog"
  | "capabilities"
  | "stories"
  | "external-services";
type ApplicationKnowledgeMode = "upload" | "view";
type RouteView =
  | "repositories"
  | "application-detail"
  | "application-capabilities"
  | "application-screen-catalog"
  | "application-knowledge"
  | "application-zapping"
  | "application-external-services"
  | "stories";
type AnalysisStepStatus = "pending" | "active" | "done" | "error";
type AnalysisProgressStep = {
  key: string;
  index: number;
  label: string;
  description: string;
  status: AnalysisStepStatus;
  statusLabel: string;
};
type AnalysisInsightItem = {
  label: string;
  value: string;
  icon: string;
};
type AnalysisInsight = {
  heading: string;
  subheading: string;
  badge: string;
  lines: string[];
  inputs: AnalysisInsightItem[];
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
const deleteConfirmOpen = ref(false);
const zappingAnalysisModalOpen = ref(false);
const zappingAnalysisRerunConfirmOpen = ref(false);
const activeZappingAnalysisVideoId = ref("");
const activeZappingAnalysisRequestId = ref("");
const pendingZappingAnalysisVideoId = ref("");
const editingApplicationId = ref<string | null>(null);
const initialApplicationRepository = ref<GitHubRepositorySummary | null>(null);
const isUploadingApplicationKnowledge = ref(false);

const showPageHeader = computed(() => currentView.value !== "application-detail");
const pageShellClass = computed(() =>
  currentView.value === "application-detail" ? "space-y-3" : "space-y-5"
);

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
const activeZappingAnalysisVideo = computed(
  () =>
    store.operationVideos.find(
      (video) => video.id === activeZappingAnalysisVideoId.value
    ) ?? null
);
const zappingAnalysisRerunTargetVideo = computed(
  () =>
    store.operationVideos.find(
      (video) => video.id === pendingZappingAnalysisVideoId.value
    ) ?? null
);
const zappingAnalysisRerunStoryCount = computed(
  () =>
    zappingAnalysisRerunTargetVideo.value?.analysisResult?.storyCandidates
      .length ?? 0
);
const zappingAnalysisProgressPercent = computed(() => {
  const status = activeZappingAnalysisVideo.value?.analysisStatus;
  if (status === "completed") return 100;
  if (status === "running") return 68;
  if (status === "queued") return 28;
  if (status === "error") return 100;
  return 0;
});
const zappingAnalysisProgressLabel = computed(() => {
  const status = activeZappingAnalysisVideo.value?.analysisStatus;
  if (status === "completed") return "解析が完了しました";
  if (status === "running") return "動画とナレッジを照合して解析しています";
  if (status === "queued") return "解析リクエストを投入しました";
  if (status === "error") return "解析に失敗しました";
  return "解析を準備しています";
});
const zappingAnalysisStoryPreview = computed(
  () => activeZappingAnalysisVideo.value?.analysisResult?.storyCandidates.slice(0, 3) ?? []
);
const zappingAnalysisStats = computed(() => {
  const video = activeZappingAnalysisVideo.value;
  return {
    frameCount: video?.frameCaptures.length ?? 0,
    transcriptChars: video?.transcriptText?.length ?? 0,
    storyCount: video?.analysisResult?.storyCandidates.length ?? 0,
  };
});
const zappingAnalysisSteps = computed<AnalysisProgressStep[]>(() => {
  const status = activeZappingAnalysisVideo.value?.analysisStatus;
  const requestStatus: AnalysisStepStatus =
    status === "queued"
      ? "active"
      : status === "running" || status === "completed"
        ? "done"
        : status === "error"
          ? "error"
          : "pending";
  const matchStatus: AnalysisStepStatus =
    status === "running"
      ? "active"
      : status === "completed"
        ? "done"
        : status === "error"
          ? "error"
          : "pending";
  const resultStatus: AnalysisStepStatus =
    status === "completed" ? "done" : status === "error" ? "error" : "pending";
  return [
    {
      key: "request",
      index: 1,
      label: "受付",
      description: "解析ジョブを作成し、仕事ログへ連携します。",
      status: requestStatus,
      statusLabel: analysisStepStatusLabel(requestStatus),
    },
    {
      key: "match",
      index: 2,
      label: "照合",
      description: "動画・文字起こし・アプリ専用ナレッジを突き合わせています。",
      status: matchStatus,
      statusLabel: analysisStepStatusLabel(matchStatus),
    },
    {
      key: "stories",
      index: 3,
      label: "ストーリー候補生成",
      description: "画面、機能、ユーザー価値、根拠シーンを候補へ変換します。",
      status: resultStatus,
      statusLabel: analysisStepStatusLabel(resultStatus),
    },
  ];
});
const zappingAnalysisInsight = computed<AnalysisInsight>(() => {
  const video = activeZappingAnalysisVideo.value;
  const status = video?.analysisStatus;
  const summary = compactZappingAnalysisText(
    video?.analysisResult?.transcriptSummary ||
      video?.transcriptSummary ||
      video?.quickScan?.transcriptSummary ||
      "",
    150
  );
  const operationIntent = compactZappingAnalysisText(
    video?.analysisResult?.operationIntent || video?.quickScan?.description || "",
    150
  );
  const productContext = compactZappingAnalysisText(
    video?.analysisResult?.productContextSummary ||
      selectedApplication.value?.name ||
      "",
    150
  );
  const firstStory = video?.analysisResult?.storyCandidates[0] ?? null;
  const inputs: AnalysisInsightItem[] = [
    {
      label: "動画メモ",
      value: operationIntent || "操作画面の変化と録画メモを読み取っています。",
      icon: "material-symbols:movie-info-outline",
    },
    {
      label: "文字起こし",
      value: summary || "発話からユーザーの目的、期待結果、確認ポイントを抽出しています。",
      icon: "material-symbols:article-outline",
    },
    {
      label: "アプリナレッジ",
      value: productContext || "アプリ専用の仕様・画面知識と照合しています。",
      icon: "material-symbols:database-search-outline",
    },
  ];

  if (status === "completed") {
    return {
      heading: "ストーリー候補を動画詳細へ反映しました",
      subheading: "抽出した候補と根拠シーンを、このまま詳細タブで確認できます。",
      badge: "完了",
      lines: [
        `${video?.analysisResult?.storyCandidates.length ?? 0}件のストーリー候補を生成しました。`,
        firstStory ? `代表候補: ${firstStory.title}` : "",
        operationIntent,
      ].filter(Boolean),
      inputs,
    };
  }

  if (status === "running") {
    return {
      heading: "操作をユーザー価値へ翻訳しています",
      subheading: "画面上の行動、発話、アプリ知識を合わせて、ストーリー候補の粒度に分解しています。",
      badge: "解析中",
      lines: [
        operationIntent || "画面遷移から操作目的を推定しています。",
        summary || "文字起こしから期待結果と確認対象を拾っています。",
        "根拠になるスクリーンショットと動画区間をストーリー候補に紐付けています。",
      ],
      inputs,
    };
  }

  if (status === "queued") {
    return {
      heading: "解析リクエストを受け付けました",
      subheading: "解析ジョブを作成し、実行ワーカーが動画とナレッジを読み始めるのを待っています。",
      badge: "受付済み",
      lines: [
        activeZappingAnalysisRequestId.value || video?.analysisRequestId
          ? `解析ジョブ: ${activeZappingAnalysisRequestId.value || video?.analysisRequestId}`
          : "",
        "仕事ログに連携し、解析ステータスを追跡しています。",
      ].filter(Boolean),
      inputs,
    };
  }

  if (status === "error") {
    return {
      heading: "解析が停止しました",
      subheading: video?.analysisErrorMessage || "解析ジョブまたは解析ワーカーの状態を確認してください。",
      badge: "要確認",
      lines: [video?.analysisErrorMessage || "解析に失敗しました。"].filter(Boolean),
      inputs,
    };
  }

  return {
    heading: "解析の準備をしています",
    subheading: "動画、文字起こし、アプリナレッジを読み込む準備をしています。",
    badge: "準備中",
    lines: [],
    inputs,
  };
});

function compactZappingAnalysisText(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function analysisStepStatusLabel(status: AnalysisStepStatus): string {
  if (status === "done") return "完了";
  if (status === "active") return "実行中";
  if (status === "error") return "確認";
  return "待機";
}

const pageTitle = computed(() => {
  if (currentView.value === "repositories") {
    return "Gitリポジトリ";
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
    return "GitHub の接続状態、リポジトリ一覧、アプリとの紐付けを確認します";
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
      label: "Gitリポジトリ",
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
          : activeApplicationTab.value === "screen-catalog"
            ? "画面カタログ"
          : activeApplicationTab.value === "knowledge-space"
            ? "ナレッジスペース"
          : activeApplicationTab.value === "zapping"
            ? "ザッピング"
          : activeApplicationTab.value === "external-services"
            ? "外部サービス連携"
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
    basic: "application-detail",
    "knowledge-space": "application-knowledge",
    zapping: "application-zapping",
    "screen-catalog": "application-screen-catalog",
    capabilities: "application-capabilities",
    stories: "stories",
    "external-services": "application-external-services",
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
  if (
    route.query.view === "application-screen-catalog" ||
    route.query.view === "application-scan"
  ) {
    return "application-screen-catalog";
  }
  if (route.query.view === "application-knowledge") return "application-knowledge";
  if (
    route.query.view === "application-zapping" ||
    route.query.view === "application-videos"
  ) {
    return "application-zapping";
  }
  if (
    route.query.view === "application-external-services" ||
    route.query.view === "application-git"
  ) {
    return "application-external-services";
  }
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
  if (routeView() === "application-screen-catalog") {
    if (!selectedApplication.value && store.applications[0]) {
      store.selectApplication(store.applications[0].id);
    }
    if (selectedApplication.value) {
      activeApplicationTab.value = "screen-catalog";
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
  if (routeView() === "application-zapping") {
    if (!selectedApplication.value && store.applications[0]) {
      store.selectApplication(store.applications[0].id);
    }
    if (selectedApplication.value) {
      activeApplicationTab.value = "zapping";
      currentView.value = "application-detail";
    }
    return;
  }
  if (routeView() === "application-external-services") {
    if (!selectedApplication.value && store.applications[0]) {
      store.selectApplication(store.applications[0].id);
    }
    if (selectedApplication.value) {
      activeApplicationTab.value = "external-services";
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
  const shouldAutoProvisionFileSpace = !input.id?.trim() && !input.fileSpaceId?.trim();
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
  if (shouldAutoProvisionFileSpace) {
    await provisionApplicationFileSpace(application, {
      startedTitle: "専用FileSpaceの作成を開始しました",
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

async function provisionSelectedApplicationFileSpace(): Promise<void> {
  const application = selectedApplication.value;
  if (!application) return;
  await provisionApplicationFileSpace(application);
}

async function provisionApplicationFileSpace(
  application: DecodedVibeControlApplication,
  options: { startedTitle?: string } = {}
): Promise<void> {
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
      title: options.startedTitle || "専用FileSpaceの作成を開始しました",
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
                "解析ジョブを確認してください",
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
  input: VibeControlOperationVideoSaveInput,
  callbacks?: {
    onSuccess?: (video: DecodedVibeControlOperationVideo) => void;
    onError?: (message: string) => void;
  }
): Promise<void> {
  try {
    const video = await store.saveOperationVideoCapture(input);
    callbacks?.onSuccess?.(video);
    toast.add({
      title: "ザッピング動画を保存しました",
      description:
        video.discoveryStatus === "queued"
          ? "DiscoveryEngine登録を開始しました"
          : video.discoveryStatus === "not_registered"
            ? "動画を保存しました。解析にはアプリ専用FileSpaceが必要です"
            : "動画は保存されましたが、検索登録を確認してください",
      color:
        video.discoveryStatus === "queued" ||
        video.discoveryStatus === "not_registered"
          ? "success"
          : "warning",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    callbacks?.onError?.(message);
    toast.add({
      title: "ザッピング動画の保存に失敗しました",
      description: message,
      color: "error",
    });
  }
}

async function appendOperationVideoClip(
  input: VibeControlOperationVideoAppendInput,
  callbacks?: {
    onSuccess?: (video: DecodedVibeControlOperationVideo) => void;
    onError?: (message: string) => void;
  }
): Promise<void> {
  try {
    const video = await store.appendOperationVideoClip(input);
    callbacks?.onSuccess?.(video);
    toast.add({
      title: "動画クリップを追加しました",
      description: "まとめて再解析すると、追加した動画も解析結果に反映されます",
      color: "success",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    callbacks?.onError?.(message);
    toast.add({
      title: "動画クリップの追加に失敗しました",
      description: message,
      color: "error",
    });
  }
}

async function updateOperationVideoClipAnalysis(
  input: VibeControlOperationVideoClipAnalysisInput,
  callbacks?: {
    onSuccess?: (video: DecodedVibeControlOperationVideo) => void;
    onError?: (message: string) => void;
  }
): Promise<void> {
  try {
    const video = await store.updateOperationVideoClipAnalysis(input);
    callbacks?.onSuccess?.(video);
    toast.add({
      title: "動画解析を保存しました",
      description: "続けてユーザーストーリー解析へ進めます",
      color: "success",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    callbacks?.onError?.(message);
    toast.add({
      title: "動画解析の保存に失敗しました",
      description: message,
      color: "error",
    });
  }
}

async function createOperationVideoGroup(input: {
  applicationId: string;
  name: string;
  description?: string;
}): Promise<void> {
  try {
    await store.createOperationVideoGroup(input);
    toast.add({
      title: "動画グループを作成しました",
      description: input.name,
      color: "success",
    });
  } catch (err) {
    toast.add({
      title: "動画グループの作成に失敗しました",
      description: err instanceof Error ? err.message : String(err),
      color: "error",
    });
  }
}

async function updateOperationVideoGroup(input: {
  groupId: string;
  name: string;
  description?: string;
}): Promise<void> {
  try {
    await store.updateOperationVideoGroup(input);
    toast.add({
      title: "動画グループを更新しました",
      color: "success",
    });
  } catch (err) {
    toast.add({
      title: "動画グループの更新に失敗しました",
      description: err instanceof Error ? err.message : String(err),
      color: "error",
    });
  }
}

async function deleteOperationVideoGroup(groupId: string): Promise<void> {
  try {
    await store.deleteOperationVideoGroup(groupId);
    toast.add({
      title: "動画グループを削除しました",
      color: "success",
    });
  } catch (err) {
    toast.add({
      title: "動画グループの削除に失敗しました",
      description: err instanceof Error ? err.message : String(err),
      color: "error",
    });
  }
}

type OperationVideoOrganizationPlan = {
  summary: string;
  groups: {
    existingGroupId?: string;
    name: string;
    description?: string;
    videoIds: string[];
    reason?: string;
  }[];
};

async function applyOperationVideoOrganizationPlan(
  plan: OperationVideoOrganizationPlan,
  callbacks?: {
    onSuccess?: () => void;
    onError?: (message: string) => void;
    onFinally?: () => void;
  }
): Promise<void> {
  try {
    if (!selectedApplication.value) {
      throw new Error("対象アプリが選択されていません");
    }
    let movedCount = 0;
    for (const groupPlan of plan.groups) {
      const group = groupPlan.existingGroupId
        ? store.operationVideoGroups.find((item) => item.id === groupPlan.existingGroupId)
        : await store.createOperationVideoGroup({
            applicationId: selectedApplication.value.id,
            name: groupPlan.name,
            description: groupPlan.description,
          });
      if (!group) continue;
      await store.moveOperationVideosToGroup({
        groupId: group.id,
        videoIds: groupPlan.videoIds,
      });
      movedCount += groupPlan.videoIds.length;
    }
    callbacks?.onSuccess?.();
    toast.add({
      title: "AI整理案を適用しました",
      description: `${plan.groups.length}グループ / ${movedCount}件の動画を整理しました`,
      color: "success",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    callbacks?.onError?.(message);
    toast.add({
      title: "AI整理案の適用に失敗しました",
      description: message,
      color: "error",
    });
  } finally {
    callbacks?.onFinally?.();
  }
}

async function updateOperationVideoTitle(
  videoId: string,
  title: string,
  callbacks?: {
    onSuccess?: () => void;
    onError?: (message: string) => void;
  }
): Promise<void> {
  try {
    await store.updateOperationVideoTitle({ videoId, title });
    callbacks?.onSuccess?.();
    toast.add({
      title: "動画タイトルを更新しました",
      color: "success",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    callbacks?.onError?.(message);
    toast.add({
      title: "動画タイトルの更新に失敗しました",
      description: message,
      color: "error",
    });
  }
}

async function deleteOperationVideo(videoId: string): Promise<void> {
  try {
    await store.deleteOperationVideo(videoId);
    toast.add({
      title: "ザッピング動画を削除しました",
      color: "success",
    });
  } catch (err) {
    toast.add({
      title: "ザッピング動画の削除に失敗しました",
      description: err instanceof Error ? err.message : String(err),
      color: "error",
    });
  }
}

async function deleteOperationVideoClip(videoId: string, clipId: string): Promise<void> {
  try {
    await store.deleteOperationVideoClip({ videoId, clipId });
    toast.add({
      title: "動画クリップを削除しました",
      color: "success",
    });
  } catch (err) {
    toast.add({
      title: "動画クリップの削除に失敗しました",
      description: err instanceof Error ? err.message : String(err),
      color: "error",
    });
  }
}

async function startZappingVideoAnalysis(
  videoId: string,
  options?: { inline?: boolean },
  callbacks?: { onStarted?: () => void; onError?: (message: string) => void }
): Promise<void> {
  const video = store.operationVideos.find((item) => item.id === videoId);
  if (
    !options?.inline &&
    video &&
    (video.analysisStatus === "completed" || Boolean(video.analysisResult))
  ) {
    pendingZappingAnalysisVideoId.value = videoId;
    zappingAnalysisRerunConfirmOpen.value = true;
    return;
  }
  await runZappingVideoAnalysis(videoId, options, callbacks);
}

function cancelZappingAnalysisRerun(): void {
  zappingAnalysisRerunConfirmOpen.value = false;
  pendingZappingAnalysisVideoId.value = "";
}

async function confirmZappingAnalysisRerun(): Promise<void> {
  const videoId = pendingZappingAnalysisVideoId.value;
  if (!videoId) return;
  zappingAnalysisRerunConfirmOpen.value = false;
  pendingZappingAnalysisVideoId.value = "";
  await runZappingVideoAnalysis(videoId);
}

async function runZappingVideoAnalysis(
  videoId: string,
  options?: { inline?: boolean },
  callbacks?: { onStarted?: () => void; onError?: (message: string) => void }
): Promise<void> {
  const application = selectedApplication.value;
  if (!application) return;
  activeZappingAnalysisVideoId.value = videoId;
  activeZappingAnalysisRequestId.value = "";
  if (!options?.inline) {
    zappingAnalysisModalOpen.value = true;
  }
  try {
    const requestId = await store.startZappingVideoAnalysis({
      applicationId: application.id,
      videoId,
    });
    activeZappingAnalysisRequestId.value = requestId;
    callbacks?.onStarted?.();
    toast.add({
      title: "ザッピング解析を開始しました",
      description: requestId,
      color: "success",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    callbacks?.onError?.(message);
    if (!options?.inline) {
      zappingAnalysisModalOpen.value = false;
    }
    toast.add({
      title: "ザッピング解析の開始に失敗しました",
      description: message,
      color: "error",
    });
  }
}

async function startRelatedContextAnalysis(
  videoId: string,
  provider: "github" | "slack" | "knowledge"
): Promise<void> {
  if (!selectedApplication.value) return;
  try {
    await store.startRelatedContextAnalysis({
      applicationId: selectedApplication.value.id,
      videoId,
      provider,
    });
  } catch (err) {
    toast.add({
      title: "関連コンテキスト取得に失敗しました",
      description: err instanceof Error ? err.message : String(err),
      color: "error",
    });
  }
}

function openAnalyzedZappingVideo(): void {
  activeApplicationTab.value = "zapping";
  currentView.value = "application-detail";
  zappingAnalysisModalOpen.value = false;
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
