<template>
  <div :class="pageShellClass">
    <StoryVaultApplicationFormModal
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
      title="ユーザーストーリー解析"
      subtitle="保存済みクリップ・文字起こし・アプリ専用ナレッジから候補を抽出しています"
      title-icon="material-symbols:psychology-outline"
      size="full"
      :ui="{ content: 'w-[92vw] max-w-[1560px]' }"
      :hide-close="activeZappingAnalysisClip?.analysisStatus === 'queued' || activeZappingAnalysisClip?.analysisStatus === 'running'"
      :close-on-backdrop="activeZappingAnalysisClip?.analysisStatus !== 'queued' && activeZappingAnalysisClip?.analysisStatus !== 'running'"
    >
      <div class="space-y-5">
        <div
          class="overflow-hidden rounded-xl border"
          :class="activeZappingAnalysisClip?.analysisStatus === 'error' ? 'border-red-200 bg-red-50' : activeZappingAnalysisClip?.analysisStatus === 'completed' ? 'border-emerald-200 bg-emerald-50' : 'border-cyan-100 bg-cyan-50'"
        >
          <div class="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div class="flex min-w-0 items-start gap-3">
              <span
                class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                :class="activeZappingAnalysisClip?.analysisStatus === 'error' ? 'bg-red-100 text-red-600' : activeZappingAnalysisClip?.analysisStatus === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-cyan-700 shadow-sm ring-1 ring-cyan-100'"
              >
                <UIcon
                  :name="activeZappingAnalysisClip?.analysisStatus === 'error' ? 'material-symbols:error-outline' : activeZappingAnalysisClip?.analysisStatus === 'completed' ? 'material-symbols:check-circle-outline' : 'material-symbols:psychology-outline'"
                  class="h-6 w-6"
                />
              </span>
              <div class="min-w-0">
                <p class="truncate text-base font-black text-slate-950">
                  {{ activeZappingAnalysisClip?.title || "クリップ" }}
                </p>
                <p class="mt-1 text-sm leading-relaxed text-slate-600">
                  {{ zappingAnalysisProgressLabel }}
                </p>
                <p class="mt-2 truncate font-mono text-[11px] text-slate-500">
                  {{ activeZappingAnalysisRequestId || activeZappingAnalysisClip?.analysisRequestId || "解析ジョブを準備中" }}
                </p>
              </div>
            </div>
            <div class="min-w-[220px] rounded-lg bg-white/80 p-3 ring-1 ring-white">
              <div class="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-slate-400">
                <span>ユーザーストーリー解析</span>
                <span>{{ zappingAnalysisProgressPercent }}%</span>
              </div>
              <UProgress
                class="mt-2"
                :model-value="zappingAnalysisProgressPercent"
                :color="activeZappingAnalysisClip?.analysisStatus === 'error' ? 'error' : activeZappingAnalysisClip?.analysisStatus === 'completed' ? 'success' : 'primary'"
              />
            </div>
          </div>
        </div>

        <div class="grid gap-5 2xl:grid-cols-[minmax(390px,0.78fr)_minmax(680px,1.22fr)]">
          <div class="flex min-h-[720px] flex-col justify-between gap-4">
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

            <div
              v-if="zappingAnalysisScanPreviewVisible"
              class="zapping-scan-card"
            >
              <div class="flex items-center justify-between gap-3 px-3 pt-3">
                <div class="min-w-0">
                  <p class="truncate text-xs font-black text-white">
                    {{ activeZappingAnalysisClip?.title || "クリップ" }}
                  </p>
                  <p class="mt-0.5 text-[11px] font-semibold text-cyan-100">
                    {{ zappingAnalysisScanStateLabel }}
                  </p>
                </div>
                <span class="zapping-scan-live">
                  <span class="h-1.5 w-1.5 rounded-full bg-cyan-300" />
                  SCAN
                </span>
              </div>

              <div class="zapping-scan-preview">
                <img
                  v-if="zappingAnalysisPreviewFrameUrl"
                  :key="zappingAnalysisPreviewFrame?.id"
                  :src="zappingAnalysisPreviewFrameUrl"
                  alt=""
                  class="h-full w-full object-cover"
                >
                <div
                  v-else
                  class="flex h-full w-full items-center justify-center bg-slate-950"
                >
                  <UIcon name="material-symbols:movie-outline" class="h-12 w-12 text-cyan-200/80" />
                </div>
                <div class="zapping-scan-grid" />
                <div class="zapping-scan-line" />
                <div class="zapping-scan-glow" />
              </div>

              <div class="grid grid-cols-3 gap-2 px-3 pb-3 text-[10px] font-bold text-cyan-50/90">
                <div class="rounded-md bg-white/10 px-2 py-1">
                  {{ zappingAnalysisStats.frameCount }} frames
                </div>
                <div class="rounded-md bg-white/10 px-2 py-1">
                  {{ zappingAnalysisStats.cueCount }} cues
                </div>
                <div class="rounded-md bg-white/10 px-2 py-1">
                  {{ zappingAnalysisProgressPercent }}%
                </div>
              </div>
            </div>
          </div>

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
          v-if="activeZappingAnalysisClip?.analysisErrorMessage"
          color="error"
          :title="activeZappingAnalysisClip.analysisErrorMessage"
        />
      </div>

      <template #footer>
        <EnButton
          variant="outline"
          color="neutral"
          size="sm"
          :disabled="activeZappingAnalysisClip?.analysisStatus === 'queued' || activeZappingAnalysisClip?.analysisStatus === 'running'"
          @click="zappingAnalysisModalOpen = false"
        >
          閉じる
        </EnButton>
        <EnButton
          v-if="activeZappingAnalysisClip?.analysisStatus === 'completed'"
          variant="ai"
          size="sm"
          leading-icon="material-symbols:visibility-outline"
          @click="openAnalyzedZappingVideo"
        >
          詳細を見る
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

    <StoryVaultRepositoryList
      v-if="currentView === 'repositories'"
      :applications="store.applications"
      :story-count-by-application-id="storyCountByApplicationId"
      @open-application="openApplicationDetail"
      @configure-repository="openCreateApplicationModalForRepository"
      @edit-application="openEditApplicationModal"
    />

    <template v-else-if="currentView === 'application-detail'">
      <template v-if="activeApplicationTab === 'stories'">
        <StoryVaultVideoStoryCurationList
          :application-id="selectedApplication?.id"
          :videos="store.activeClipRecords"
        />
      </template>

      <template v-else-if="activeApplicationTab === 'capabilities'">
        <StoryVaultGenerationWorkbench
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
        <StoryVaultApplicationDetail
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

        <StoryVaultSourceSetup
          :selected-application="selectedApplication"
          :source-connections="store.activeSourceConnections"
          @persist="store.persistCurrentSnapshot()"
        />
      </template>

      <StoryVaultApplicationScanResultsPanel
        v-else-if="activeApplicationTab === 'screen-catalog'"
        :application="selectedApplication"
        :run="selectedApplication?.lastScan ?? null"
      />

      <template v-else-if="activeApplicationTab === 'knowledge-space'">
        <StoryVaultApplicationKnowledgeSpacePanel
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

      <StoryVaultOperationVideoPanel
        v-else-if="activeApplicationTab === 'zapping'"
        :application="selectedApplication"
        :clip-records="store.activeClipRecords"
        :clips="store.activeClips"
        :clip-groups="store.activeClipGroups"
        :is-saving="store.isSavingOperationVideo"
        :is-analyzing="store.isAnalyzingZappingVideos"
        :is-fetching-related-contexts="store.isFetchingRelatedContexts"
        :is-provisioning-file-space="store.isProvisioningApplicationFileSpace"
        @create-file-space="provisionSelectedApplicationFileSpace"
        @analyze="startZappingVideoAnalysis"
        @fetch-related-context="startRelatedContextAnalysis"
        @collect-related-contexts="collectAllRelatedContexts"
        @link-jira-issues="linkJiraIssuesToClip"
        @unlink-jira-issue="unlinkJiraIssueFromClip"
        @link-knowledge-documents="linkKnowledgeDocumentsToClip"
        @unlink-knowledge-document="unlinkKnowledgeDocumentFromClip"
        @save="saveOperationVideo"
        @update-clip-analysis="updateOperationVideoClipAnalysis"
        @create-clip-group="createClipGroup"
        @update-clip-group="updateClipGroup"
        @delete-clip-group="deleteClipGroup"
        @apply-clip-group-organization-plan="applyClipGroupOrganizationPlan"
        @move-clip="moveClipToGroup"
        @update-title="updateClipTitle"
        @delete="deleteClip"
        @refresh="store.fetchFromFirestore()"
      />

      <StoryVaultExternalServicesPanel
        v-else-if="activeApplicationTab === 'external-services'"
        :application="selectedApplication"
      />
    </template>

    <template v-else>
      <StoryVaultStoryDetail
        :application="selectedApplication"
        :story="selectedStory"
        :evidence="store.selectedEvidence"
        :source-assets="store.activeSourceAssets"
        :operation-videos="store.activeClipRecords"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useStoryVaultStore } from "@stores/storyVault";
import { useGeminiFileSpaceOperatorStore } from "@stores/geminiFileSpaceOperator";
import { useGlobalLoadingStore } from "@stores/global-loading";
import { useOrganizationStore } from "@stores/organization";
import { useSpaceStore } from "@stores/space";
import { useGeminiFileSpaceSnapshot } from "@composables/useGeminiFileSpaceSnapshot";
import { useGoogleDriveFolderSync } from "@composables/useGoogleDriveFolderSync";
import { resolveArtifactDisplayUrl } from "@utils/artifactDisplayUrl";
import DataSourceUploadMode from "@components/dataSource/DataSourceUploadMode.vue";
import DataSourceViewMode from "@components/dataSource/DataSourceViewMode.vue";
import StoryVaultApplicationKnowledgeSpacePanel from "@components/storyVault/StoryVaultApplicationKnowledgeSpacePanel.vue";
import type {
  DecodedStoryVaultApplication,
  DecodedStoryVaultClip,
  StoryVaultRelatedContextKnowledgeDocument,
  StoryVaultRelatedContextJiraIssue,
} from "@models/storyVault";
import type {
  DecodedFileSpaceOperationRequest,
  Document,
} from "@models/geminiFileSpaceRequest";
import type {
  StoryVaultApplicationInput,
  StoryVaultClipAnalysisInput,
  StoryVaultClipSaveInput,
  StoryVaultGenerationInput,
} from "@stores/storyVault";
import type { GitHubRepositorySummary } from "@composables/useGitHubOAuth";

type StoryVaultView =
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
  name: "AdminStoryVaultIndexPage",
});

definePageMeta({
  name: "admin-storyvault",
  layout: "admin",
  middleware: ["admin-logged-in-check"],
  adminPageStack: false,
});

const store = useStoryVaultStore();
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
const currentView = ref<StoryVaultView>("application-detail");
const activeApplicationTab = ref<ApplicationDetailTab>("stories");
const applicationKnowledgeMode = ref<ApplicationKnowledgeMode>("upload");
const applicationKnowledgeDocumentsByFileSpace = ref<Record<string, Document[]>>(
  {}
);
const applicationModalOpen = ref(false);
const deleteConfirmOpen = ref(false);
const zappingAnalysisModalOpen = ref(false);
const activeZappingAnalysisClipId = ref("");
const activeZappingAnalysisRequestId = ref("");
const zappingAnalysisPreviewFrameUrl = ref("");
const zappingAnalysisPreviewFrameIndex = ref(0);
const editingApplicationId = ref<string | null>(null);
const initialApplicationRepository = ref<GitHubRepositorySummary | null>(null);
const isUploadingApplicationKnowledge = ref(false);
let zappingAnalysisPreviewFrameLoadToken = 0;
let zappingAnalysisPreviewFrameTimer: ReturnType<typeof setInterval> | null = null;
let applicationFileSpaceProvisioningWatcher: ReturnType<
  typeof useGeminiFileSpaceSnapshot
> | null = null;
let applicationFileSpaceProvisioningWatchKey = "";

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
const activeZappingAnalysisClip = computed(
  () =>
    store.clips.find(
      (clip) => clip.id === activeZappingAnalysisClipId.value
    ) ?? null
);
const zappingAnalysisProgressPercent = computed(() => {
  const status = activeZappingAnalysisClip.value?.analysisStatus;
  if (status === "completed") return 100;
  if (status === "running") return 68;
  if (status === "queued") return 28;
  if (status === "error") return 100;
  return 0;
});
const zappingAnalysisProgressLabel = computed(() => {
  const status = activeZappingAnalysisClip.value?.analysisStatus;
  if (status === "completed") return "解析が完了しました";
  if (status === "running") return "クリップとナレッジを照合して解析しています";
  if (status === "queued") return "解析リクエストを投入しました";
  if (status === "error") return "解析に失敗しました";
  return "解析を準備しています";
});
const zappingAnalysisStoryPreview = computed(
  () => activeZappingAnalysisClip.value?.analysisResult?.storyCandidates.slice(0, 3) ?? []
);
const zappingAnalysisStats = computed(() => {
  const video = activeZappingAnalysisClip.value;
  return {
    frameCount: video?.frameCaptures.length ?? 0,
    cueCount: video?.transcriptSegments.length ?? 0,
    transcriptChars: video?.transcriptText?.length ?? 0,
    storyCount: video?.analysisResult?.storyCandidates.length ?? 0,
  };
});
const zappingAnalysisScanPreviewVisible = computed(() => {
  const status = activeZappingAnalysisClip.value?.analysisStatus;
  return status === "queued" || status === "running";
});
const zappingAnalysisScanStateLabel = computed(() => {
  const status = activeZappingAnalysisClip.value?.analysisStatus;
  if (status === "queued") return "解析キューを待機中";
  if (status === "running") return "フレームと発話を走査中";
  return "プレビュー";
});
const zappingAnalysisPreviewFrame = computed(() => {
  const frames = activeZappingAnalysisClip.value?.frameCaptures ?? [];
  if (frames.length === 0) return null;
  const safeIndex = zappingAnalysisPreviewFrameIndex.value % frames.length;
  return frames[safeIndex] ?? frames[0] ?? null;
});
const zappingAnalysisSteps = computed<AnalysisProgressStep[]>(() => {
  const status = activeZappingAnalysisClip.value?.analysisStatus;
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
      description: "クリップ・文字起こし・アプリ専用ナレッジを突き合わせています。",
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
  const video = activeZappingAnalysisClip.value;
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
      label: "クリップメモ",
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
      heading: "ストーリー候補をクリップ詳細へ反映しました",
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
        "根拠になるスクリーンショットとクリップ区間をストーリー候補に紐付けています。",
      ],
      inputs,
    };
  }

  if (status === "queued") {
    return {
      heading: "解析リクエストを受け付けました",
      subheading: "解析ジョブを作成し、実行ワーカーがクリップとナレッジを読み始めるのを待っています。",
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
    subheading: "クリップ、文字起こし、アプリナレッジを読み込む準備をしています。",
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
    const legacyStoryCount = store.stories.filter(
      (story) => story.applicationId === application.id
    ).length;
    const clipStoryCount = store.clips
      .filter((clip) => clip.applicationId === application.id)
      .reduce(
        (sum, clip) =>
          sum + (clip.analysisResult?.storyCandidates.length ?? 0),
        0
      );
    counts[application.id] = legacyStoryCount + clipStoryCount;
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

watch(
  () => ({
    applicationId: selectedApplication.value?.id ?? "",
    requestId: selectedApplication.value?.fileSpaceCreateRequestId ?? "",
    status: selectedApplication.value?.fileSpaceProvisioningStatus ?? "",
  }),
  ({ applicationId, requestId, status }) => {
    if (applicationId && requestId && status === "creating") {
      startApplicationFileSpaceProvisioningWatcher(applicationId, requestId);
      return;
    }
    stopApplicationFileSpaceProvisioningWatcher();
  },
  { immediate: true }
);

watch(syncCompletedTick, () => {
  if (activeApplicationTab.value !== "knowledge-space") return;
  void refreshApplicationKnowledgeDocuments();
});

watch(
  [
    zappingAnalysisModalOpen,
    zappingAnalysisScanPreviewVisible,
    () => activeZappingAnalysisClip.value?.id,
    () => activeZappingAnalysisClip.value?.frameCaptures.length ?? 0,
  ],
  ([isOpen, isVisible, clipId, frameCount]) => {
    stopZappingAnalysisPreviewFrameTimer();
    zappingAnalysisPreviewFrameIndex.value = 0;
    if (!isOpen || !isVisible || !clipId || frameCount <= 1) return;
    zappingAnalysisPreviewFrameTimer = setInterval(() => {
      zappingAnalysisPreviewFrameIndex.value =
        (zappingAnalysisPreviewFrameIndex.value + 1) % frameCount;
    }, 1000);
  },
  { immediate: true }
);

watch(
  [
    zappingAnalysisModalOpen,
    zappingAnalysisScanPreviewVisible,
    () => zappingAnalysisPreviewFrame.value?.bucketName,
    () => zappingAnalysisPreviewFrame.value?.storagePath,
    () => zappingAnalysisPreviewFrame.value?.contentType,
  ],
  async ([isOpen, isVisible, bucketName, storagePath, contentType]) => {
    const token = ++zappingAnalysisPreviewFrameLoadToken;
    zappingAnalysisPreviewFrameUrl.value = "";
    if (!isOpen || !isVisible || !bucketName || !storagePath) return;
    const url = await resolveArtifactDisplayUrl({
      storageGcsPath: `gs://${bucketName}/${storagePath}`,
      contentType: contentType || "image/jpeg",
    });
    if (token !== zappingAnalysisPreviewFrameLoadToken) return;
    zappingAnalysisPreviewFrameUrl.value = url ?? "";
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  stopZappingAnalysisPreviewFrameTimer();
  stopApplicationFileSpaceProvisioningWatcher();
});

function stopZappingAnalysisPreviewFrameTimer(): void {
  if (!zappingAnalysisPreviewFrameTimer) return;
  clearInterval(zappingAnalysisPreviewFrameTimer);
  zappingAnalysisPreviewFrameTimer = null;
}

function stopApplicationFileSpaceProvisioningWatcher(): void {
  applicationFileSpaceProvisioningWatcher?.unsubscribe();
  applicationFileSpaceProvisioningWatcher = null;
  applicationFileSpaceProvisioningWatchKey = "";
}

function startApplicationFileSpaceProvisioningWatcher(
  applicationId: string,
  requestId: string
): void {
  const watchKey = `${applicationId}:${requestId}`;
  if (applicationFileSpaceProvisioningWatchKey === watchKey) return;
  stopApplicationFileSpaceProvisioningWatcher();
  applicationFileSpaceProvisioningWatchKey = watchKey;
  applicationFileSpaceProvisioningWatcher = useGeminiFileSpaceSnapshot(
    requestId,
    (request) => {
      void handleApplicationFileSpaceProvisioningSnapshot(applicationId, request);
    }
  );
}

async function handleApplicationFileSpaceProvisioningSnapshot(
  applicationId: string,
  request: DecodedFileSpaceOperationRequest
): Promise<void> {
  const updatedApplication = await store.resolveApplicationFileSpaceProvisioning({
    applicationId,
    request,
  });
  if (request.status === "completed") {
    if (updatedApplication?.fileSpaceProvisioningStatus === "error") {
      toast.add({
        title: "専用FileSpaceの作成に失敗しました",
        description:
          updatedApplication.fileSpaceErrorMessage ||
          "FileSpace IDを取得できませんでした",
        color: "error",
      });
      stopApplicationFileSpaceProvisioningWatcher();
      return;
    }
    toast.add({
      title: "アプリに専用FileSpaceを紐付けました",
      description: updatedApplication?.fileSpaceId,
      color: "success",
    });
    if (activeApplicationTab.value === "knowledge-space") {
      void refreshApplicationKnowledgeDocuments();
    }
    stopApplicationFileSpaceProvisioningWatcher();
  } else if (request.status === "error") {
    toast.add({
      title: "専用FileSpaceの作成に失敗しました",
      description:
        request.errorMessage ||
        updatedApplication?.fileSpaceErrorMessage ||
        "解析ジョブを確認してください",
      color: "error",
    });
    stopApplicationFileSpaceProvisioningWatcher();
  }
}

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

function openEditApplicationModal(application?: DecodedStoryVaultApplication): void {
  const target = application ?? selectedApplication.value;
  if (!target) return;
  editingApplicationId.value = target.id;
  initialApplicationRepository.value = null;
  applicationModalOpen.value = true;
}

async function saveApplication(input: StoryVaultApplicationInput): Promise<void> {
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
  input: StoryVaultGenerationInput
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
  application: DecodedStoryVaultApplication,
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

    startApplicationFileSpaceProvisioningWatcher(application.id, requestId);
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
          description: `StoryVault knowledge for ${application.name}: ${file.name}`,
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
  input: StoryVaultClipSaveInput,
  callbacks?: {
    onSuccess?: (clip: DecodedStoryVaultClip) => void;
    onError?: (message: string) => void;
  }
): Promise<void> {
  try {
    const clip = await store.saveClipToGroup(input);
    callbacks?.onSuccess?.(clip);
    toast.add({
      title: "クリップを保存しました",
      description:
        clip.discoveryStatus === "queued"
          ? "DiscoveryEngine登録を開始しました"
          : clip.discoveryStatus === "not_registered"
            ? "クリップを保存しました。解析にはアプリ専用FileSpaceが必要です"
            : "クリップは保存されましたが、検索登録を確認してください",
      color:
        clip.discoveryStatus === "queued" ||
        clip.discoveryStatus === "not_registered"
          ? "success"
          : "warning",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    callbacks?.onError?.(message);
    toast.add({
      title: "クリップの保存に失敗しました",
      description: message,
      color: "error",
    });
  }
}

async function updateOperationVideoClipAnalysis(
  input: StoryVaultClipAnalysisInput,
  callbacks?: {
    onSuccess?: (clip: DecodedStoryVaultClip) => void;
    onError?: (message: string) => void;
  }
): Promise<void> {
  try {
    const clip = await store.updateClipAnalysis(input);
    callbacks?.onSuccess?.(clip);
    toast.add({
      title: "クリップ解析を保存しました",
      description: "続けてユーザーストーリー解析へ進めます",
      color: "success",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    callbacks?.onError?.(message);
    toast.add({
      title: "クリップ解析の保存に失敗しました",
      description: message,
      color: "error",
    });
  }
}

async function createClipGroup(input: {
  applicationId: string;
  name: string;
  description?: string;
}): Promise<void> {
  try {
    await store.createClipGroup(input);
    toast.add({
      title: "クリップグループを作成しました",
      description: input.name,
      color: "success",
    });
  } catch (err) {
    toast.add({
      title: "クリップグループの作成に失敗しました",
      description: err instanceof Error ? err.message : String(err),
      color: "error",
    });
  }
}

async function updateClipGroup(input: {
  groupId: string;
  name: string;
  description?: string;
}): Promise<void> {
  try {
    await store.updateClipGroup(input);
    toast.add({
      title: "クリップグループを更新しました",
      color: "success",
    });
  } catch (err) {
    toast.add({
      title: "クリップグループの更新に失敗しました",
      description: err instanceof Error ? err.message : String(err),
      color: "error",
    });
  }
}

async function deleteClipGroup(groupId: string): Promise<void> {
  try {
    await store.deleteClipGroup(groupId);
    toast.add({
      title: "クリップグループを削除しました",
      color: "success",
    });
  } catch (err) {
    toast.add({
      title: "クリップグループの削除に失敗しました",
      description: err instanceof Error ? err.message : String(err),
      color: "error",
    });
  }
}

type ClipGroupOrganizationPlan = {
  summary: string;
  groups: {
    existingGroupId?: string;
    name: string;
    description?: string;
    clipIds: string[];
    reason?: string;
  }[];
};

async function applyClipGroupOrganizationPlan(
  plan: ClipGroupOrganizationPlan,
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
        ? store.activeClipGroups.find((item) => item.id === groupPlan.existingGroupId)
        : await store.createClipGroup({
            applicationId: selectedApplication.value.id,
            name: groupPlan.name,
            description: groupPlan.description,
          });
      if (!group) continue;
      await store.moveClipsToGroup({
        groupId: group.id,
        clipIds: groupPlan.clipIds,
      });
      movedCount += groupPlan.clipIds.length;
    }
    callbacks?.onSuccess?.();
    toast.add({
      title: "AI整理案を適用しました",
      description: `${plan.groups.length}グループ / ${movedCount}件のクリップを整理しました`,
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

async function updateClipTitle(
  clipId: string,
  title: string,
  callbacks?: {
    onSuccess?: () => void;
    onError?: (message: string) => void;
  }
): Promise<void> {
  try {
    await store.updateClipTitle({ clipId, title });
    callbacks?.onSuccess?.();
    toast.add({
      title: "クリップタイトルを更新しました",
      color: "success",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    callbacks?.onError?.(message);
    toast.add({
      title: "クリップタイトルの更新に失敗しました",
      description: message,
      color: "error",
    });
  }
}

async function deleteClip(clipId: string): Promise<void> {
  try {
    await store.deleteClip(clipId);
    toast.add({
      title: "クリップを削除しました",
      color: "success",
    });
  } catch (err) {
    toast.add({
      title: "クリップの削除に失敗しました",
      description: err instanceof Error ? err.message : String(err),
      color: "error",
    });
  }
}

async function moveClipToGroup(clipId: string, groupId: string): Promise<void> {
  try {
    await store.moveClipsToGroup({ clipIds: [clipId], groupId });
    const groupName = store.clipGroups.find((group) => group.id === groupId)?.name || "選択したグループ";
    toast.add({
      title: "クリップを移動しました",
      description: `${groupName}へ移動しました`,
      color: "success",
    });
  } catch (err) {
    toast.add({
      title: "クリップの移動に失敗しました",
      description: err instanceof Error ? err.message : String(err),
      color: "error",
    });
  }
}

async function startZappingVideoAnalysis(
  clipId: string,
  options?: { inline?: boolean },
  callbacks?: { onStarted?: () => void; onError?: (message: string) => void }
): Promise<void> {
  const clip = store.clips.find((item) => item.id === clipId);
  if (
    clip &&
    (clip.analysisStatus === "completed" || Boolean(clip.analysisResult))
  ) {
    callbacks?.onError?.("ユーザーストーリー解析は完了済みです");
    return;
  }
  await runZappingVideoAnalysis(clipId, options, callbacks);
}

async function runZappingVideoAnalysis(
  clipId: string,
  options?: { inline?: boolean },
  callbacks?: { onStarted?: () => void; onError?: (message: string) => void }
): Promise<void> {
  const application = selectedApplication.value;
  if (!application) return;
  activeZappingAnalysisClipId.value = clipId;
  activeZappingAnalysisRequestId.value = "";
  if (!options?.inline) {
    zappingAnalysisModalOpen.value = true;
  }
  try {
    const requestId = await store.startZappingVideoAnalysis({
      applicationId: application.id,
      clipId,
    });
    activeZappingAnalysisRequestId.value = requestId;
    callbacks?.onStarted?.();
    toast.add({
      title: "ユーザーストーリー解析を開始しました",
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
      title: "ユーザーストーリー解析の開始に失敗しました",
      description: message,
      color: "error",
    });
  }
}

async function startRelatedContextAnalysis(
  clipId: string,
  provider: "github" | "slack" | "knowledge" | "jira"
): Promise<void> {
  if (!selectedApplication.value) return;
  try {
    await store.startRelatedContextAnalysis({
      applicationId: selectedApplication.value.id,
      clipId,
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

async function collectAllRelatedContexts(clipId: string): Promise<void> {
  if (!selectedApplication.value) return;
  await Promise.all(
    (["knowledge", "github", "jira"] as const).map((provider) =>
      startRelatedContextAnalysis(clipId, provider)
    )
  );
}

async function linkJiraIssuesToClip(
  clipId: string,
  issues: StoryVaultRelatedContextJiraIssue[],
  site?: { name?: string; url?: string }
): Promise<void> {
  try {
    await store.linkJiraIssuesToClip({
      clipId,
      issues,
      siteName: site?.name,
      siteUrl: site?.url,
    });
    toast.add({
      title: `${issues.length}件のJira Issueを紐付けました`,
      color: "success",
    });
  } catch (err) {
    toast.add({
      title: "Jira Issueの紐付けに失敗しました",
      description: err instanceof Error ? err.message : String(err),
      color: "error",
    });
  }
}

async function unlinkJiraIssueFromClip(
  clipId: string,
  issueKey: string,
  cloudId?: string
): Promise<void> {
  try {
    await store.unlinkJiraIssueFromClip({ clipId, issueKey, cloudId });
    toast.add({ title: `${issueKey}の紐付けを解除しました`, color: "success" });
  } catch (err) {
    toast.add({
      title: "Jira Issueの紐付け解除に失敗しました",
      description: err instanceof Error ? err.message : String(err),
      color: "error",
    });
  }
}

async function linkKnowledgeDocumentsToClip(
  clipId: string,
  fileSpaceId: string,
  documents: StoryVaultRelatedContextKnowledgeDocument[]
): Promise<void> {
  try {
    await store.linkKnowledgeDocumentsToClip({ clipId, fileSpaceId, documents });
    toast.add({ title: `${documents.length}件のナレッジを紐付けました`, color: "success" });
  } catch (err) {
    toast.add({
      title: "ナレッジの紐付けに失敗しました",
      description: err instanceof Error ? err.message : String(err),
      color: "error",
    });
  }
}

async function unlinkKnowledgeDocumentFromClip(
  clipId: string,
  documentId: string
): Promise<void> {
  try {
    await store.unlinkKnowledgeDocumentFromClip({ clipId, documentId });
    toast.add({ title: "ナレッジの紐付けを解除しました", color: "success" });
  } catch (err) {
    toast.add({
      title: "ナレッジの紐付け解除に失敗しました",
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

<style scoped>
.zapping-scan-card {
  overflow: hidden;
  border: 1px solid rgba(103, 232, 249, 0.42);
  border-radius: 12px;
  background:
    radial-gradient(circle at 18% 8%, rgba(34, 211, 238, 0.24), transparent 30%),
    linear-gradient(145deg, #07111f 0%, #0f172a 48%, #062a31 100%);
  box-shadow:
    0 18px 40px rgba(15, 23, 42, 0.18),
    inset 0 0 0 1px rgba(255, 255, 255, 0.05);
}

.zapping-scan-live {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  background: rgba(8, 145, 178, 0.28);
  padding: 4px 8px;
  color: #cffafe;
  font-size: 10px;
  font-weight: 800;
}

.zapping-scan-preview {
  position: relative;
  margin: 12px;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: 8px;
  background: #020617;
  box-shadow:
    inset 0 0 0 1px rgba(207, 250, 254, 0.14),
    0 0 28px rgba(6, 182, 212, 0.18);
}

.zapping-scan-preview img {
  filter: saturate(1.06) contrast(1.03);
}

.zapping-scan-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(103, 232, 249, 0.15) 1px, transparent 1px),
    linear-gradient(90deg, rgba(103, 232, 249, 0.12) 1px, transparent 1px);
  background-size: 28px 28px;
  opacity: 0.38;
  pointer-events: none;
}

.zapping-scan-line {
  position: absolute;
  top: -32%;
  left: 0;
  width: 100%;
  height: 32%;
  background:
    linear-gradient(
      to bottom,
      transparent 0%,
      rgba(34, 211, 238, 0.12) 42%,
      rgba(34, 211, 238, 0.9) 50%,
      rgba(34, 211, 238, 0.18) 58%,
      transparent 100%
    );
  box-shadow: 0 0 24px rgba(34, 211, 238, 0.7);
  animation: zapping-scan-sweep 1.8s ease-in-out infinite;
  pointer-events: none;
}

.zapping-scan-glow {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(120deg, transparent 0%, rgba(45, 212, 191, 0.18) 44%, transparent 62%),
    radial-gradient(circle at 50% 50%, transparent 46%, rgba(6, 182, 212, 0.18) 100%);
  animation: zapping-scan-pulse 1.4s ease-in-out infinite;
  pointer-events: none;
}

@keyframes zapping-scan-sweep {
  0% {
    transform: translateY(0);
  }
  48% {
    transform: translateY(410%);
  }
  100% {
    transform: translateY(410%);
  }
}

@keyframes zapping-scan-pulse {
  0%,
  100% {
    opacity: 0.42;
  }
  50% {
    opacity: 0.78;
  }
}
</style>
