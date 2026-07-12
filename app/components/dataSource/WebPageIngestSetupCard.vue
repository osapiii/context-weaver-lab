<template>
  <div class="flex min-h-0 flex-1 flex-col gap-3">
    <div class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
      <EnSelectMenu
        v-model="selectedFolderId"
        :items="folderOptions"
        value-key="value"
        label-key="label"
        size="sm"
        :search-input="false"
        :disabled="!fileSpaceId || isSessionRunning"
      />
      <EnButton
        variant="soft"
        color="neutral"
        size="sm"
        leading-icon="i-heroicons-folder-plus"
        :disabled="!fileSpaceId || isSessionRunning"
        @click="startNewFolder"
      >
        新規
      </EnButton>
    </div>

    <UInput
      v-if="selectedFolderId === NEW_FOLDER_ID"
      v-model="newFolderName"
      placeholder="取り込みフォルダ名"
      size="sm"
      class="w-full"
      :disabled="!fileSpaceId || isSessionRunning"
    />

    <UTextarea
      v-if="selectedFolderId === NEW_FOLDER_ID"
      v-model="newFolderDescription"
      placeholder="このフォルダで集めるページ情報の補足説明"
      :rows="2"
      size="sm"
      class="w-full"
      :disabled="!fileSpaceId || isSessionRunning"
    />

    <form @submit.prevent="onImportClick">
      <UInput
        v-model="urlInput"
        placeholder="https://example.com/blog や HP の URL"
        size="md"
        class="w-full"
        :disabled="!fileSpaceId || isSessionRunning"
      />
    </form>

    <details class="group/web-advanced text-xs text-gray-500" open>
      <summary
        class="cursor-pointer list-none font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 [&::-webkit-details-marker]:hidden"
      >
        <span class="inline-flex items-center gap-1">
          <UIcon
            name="i-heroicons-adjustments-horizontal"
            class="h-3.5 w-3.5"
          />
          詳細設定
          <span class="font-normal text-gray-400">
            (深さ {{ maxDepth }} · 最大 {{ maxUrls }} ページ)
          </span>
          <UIcon
            name="i-heroicons-chevron-down"
            class="h-3 w-3 transition-transform group-open/web-advanced:rotate-180"
          />
        </span>
      </summary>

      <fieldset
        :disabled="!fileSpaceId || isSessionRunning"
        class="mt-3 space-y-3 disabled:opacity-60"
      >
        <div>
          <label
            class="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-300"
          >
            探索の深さ
            <span class="ml-1 font-normal text-gray-400">(リンクを何段階先まで)</span>
          </label>
          <div class="grid grid-cols-3 gap-1.5">
            <button
              v-for="d in [1, 2, 3]"
              :key="`depth-${d}`"
              type="button"
              class="rounded-lg border px-2 py-2 text-center text-xs font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
              :class="
                maxDepth === d
                  ? 'border-purple-400 bg-purple-50 text-purple-700 ring-1 ring-purple-300/60'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-purple-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
              "
              @click="maxDepth = d"
            >
              <div class="font-bold">{{ d }}</div>
              <div class="mt-0.5 text-[9px] text-gray-500">
                {{ d === 1 ? "ページのみ" : d === 2 ? "+ 直リンク" : "+ さらに先" }}
              </div>
            </button>
          </div>
        </div>

        <div>
          <label
            class="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-300"
          >
            最大ページ数
          </label>
          <div class="grid grid-cols-5 gap-1.5">
            <button
              v-for="opt in maxUrlOptions"
              :key="`max-${opt.value}`"
              type="button"
              class="rounded-lg border px-2 py-1.5 text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
              :class="
                maxUrls === opt.value
                  ? 'border-purple-400 bg-purple-50 text-purple-700 ring-1 ring-purple-300/60'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-purple-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
              "
              :title="opt.hint"
              @click="maxUrls = opt.value"
            >
              <div>{{ opt.value }}</div>
              <div
                v-if="opt.hint"
                class="mt-0.5 text-[9px] font-normal text-gray-500"
              >
                {{ opt.hint }}
              </div>
            </button>
          </div>
        </div>

        <div>
          <label
            class="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-300"
          >
            メモ (任意)
          </label>
          <UInput
            v-model="description"
            :placeholder="memoPlaceholder"
            size="sm"
            class="w-full"
          />
        </div>
      </fieldset>
    </details>

    <EnAlert
      v-if="session.phase === 'error' && session.errorMessage"
      color="error"
      title="取り込みエラー"
      :description="session.errorMessage"
    >
      <template #actions>
        <EnButton
          variant="outline"
          color="neutral"
          size="xs"
          @click="webCrawlStore.openIngestProgressModal()"
        >
          詳細を見る
        </EnButton>
      </template>
    </EnAlert>

    <div
      v-if="statusMessage"
      class="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700 ring-1 ring-gray-900/[0.04] dark:bg-gray-800/60 dark:text-gray-300 dark:ring-white/10"
      role="status"
    >
      <UIcon
        :name="statusIcon"
        class="h-4 w-4 shrink-0"
        :class="[
          statusIconSpin ? 'animate-spin text-purple-600' : '',
          statusIconTone,
        ]"
      />
      <span class="min-w-0 flex-1 leading-snug">{{ statusMessage }}</span>
    </div>

    <div class="mt-auto flex justify-end pt-1">
      <EnButton
        variant="hero"
        color="primary"
        size="sm"
        :disabled="!canStartImport && !isSessionRunning"
        :loading="isStartingImport"
        leading-icon="i-heroicons-globe-alt"
        :custom-class="
          [
            'shrink-0',
            isSessionRunning && !isStartingImport ? '[&_svg]:animate-spin' : '',
          ].join(' ')
        "
        @click="onImportClick"
      >
        {{
          isSessionRunning
            ? "取り込み中… 進捗を見る"
            : "取り込み"
        }}
      </EnButton>
    </div>

    <details class="group/web-help text-xs text-gray-500">
      <summary
        class="cursor-pointer list-none font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 [&::-webkit-details-marker]:hidden"
      >
        <span class="inline-flex items-center gap-1">
          <UIcon
            name="i-heroicons-information-circle"
            class="h-3.5 w-3.5"
          />
          取り込みの仕組み
          <UIcon
            name="i-heroicons-chevron-down"
            class="h-3 w-3 transition-transform group-open/web-help:rotate-180"
          />
        </span>
      </summary>
      <p class="mt-2 leading-relaxed text-gray-500 dark:text-gray-400">
        指定 URL からサブページも自動で巡回し、テキストと画像を AI に登録します。
        完了まで <strong>1〜5 分</strong> ほどかかる場合があります。実行中も他の作業を続けられます。
      </p>
    </details>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, toRef, watch } from "vue";
import { storeToRefs } from "pinia";
import EnAlert from "@components/EnAlert.vue";
import EnButton from "@components/EnButton.vue";
import { useWebCrawlRequestStore } from "@stores/webCrawlRequest";
import { useWebCrawlGlobalIngest } from "@composables/useWebCrawlGlobalIngest";
import { webPageHostname } from "@utils/webPageUrl";
import {
  getWebCrawlProgressPercent,
  getWebCrawlStepLabel,
} from "@utils/webCrawlProgress";
import createRandomId from "@utils/createRandomDocId";
import { resolveWebCrawlImportFolder } from "@utils/webCrawlImportFolder";

const props = defineProps<{
  fileSpaceId: string | null;
}>();

const emit = defineEmits<{
  completed: [];
}>();

useWebCrawlGlobalIngest();

const webCrawlStore = useWebCrawlRequestStore();
const {
  activeIngestSession: session,
  activeWatchingRequest,
  isIngestRunning,
} = storeToRefs(webCrawlStore);

const { submit, isSubmitting } = useWebPageIngestSubmit(
  toRef(props, "fileSpaceId")
);

const maxUrlOptions = [
  { value: 1, hint: "このページのみ" },
  { value: 10, hint: "" },
  { value: 30, hint: "" },
  { value: 50, hint: "" },
  { value: 100, hint: "" },
] as const;

const urlInput = ref("");
const maxDepth = ref(1);
const maxUrls = ref(30);
const description = ref("");
const isStartingImport = ref(false);
const NEW_FOLDER_ID = "__new__";
const selectedFolderId = ref(NEW_FOLDER_ID);
const newFolderName = ref("");
const newFolderDescription = ref("");
const newFolderId = ref(`webFolder_${Date.now()}_${createRandomId()}`);

const foldersForFileSpace = computed(() =>
  webCrawlStore.importFolders.filter((folder) =>
    webCrawlStore.recentRequests.some(
      (request) =>
        request.input.fileSpaceId === props.fileSpaceId &&
        resolveWebCrawlImportFolder(request).id === folder.id
    )
  )
);

const folderOptions = computed(() => [
  { value: NEW_FOLDER_ID, label: "新しい取り込みフォルダ" },
  ...foldersForFileSpace.value.map((folder) => ({
    value: folder.id,
    label: folder.name,
  })),
]);

const selectedImportFolder = computed(() => {
  if (selectedFolderId.value === NEW_FOLDER_ID) {
    const name = newFolderName.value.trim();
    return name
      ? {
          id: newFolderId.value,
          name,
          description: newFolderDescription.value.trim() || null,
        }
      : null;
  }
  return (
    foldersForFileSpace.value.find(
      (folder) => folder.id === selectedFolderId.value
    ) ?? null
  );
});

const hostname = computed(() => webPageHostname(urlInput.value));
const memoPlaceholder = computed(
  () => `AI 作業スペースから取り込み: ${hostname.value || "example.com"}`
);

const isSessionRunning = computed(() => isIngestRunning.value);

const canStartImport = computed(
  () =>
      !!props.fileSpaceId &&
      !!hostname.value &&
      !!selectedImportFolder.value &&
      !isSessionRunning.value &&
      !isSubmitting.value
);

const startNewFolder = () => {
  newFolderId.value = `webFolder_${Date.now()}_${createRandomId()}`;
  selectedFolderId.value = NEW_FOLDER_ID;
  newFolderName.value = hostname.value || "";
  newFolderDescription.value = "";
};

onMounted(async () => {
  await webCrawlStore.fetchRecentRequests();
  const first = foldersForFileSpace.value[0];
  if (first) selectedFolderId.value = first.id;
});

const statusMessage = computed(() => {
  if (session.value.phase === "running") {
    const percent = activeWatchingRequest.value
      ? getWebCrawlProgressPercent(activeWatchingRequest.value)
      : 0;
    const step =
      session.value.progress.currentStep ??
      activeWatchingRequest.value?.progress?.currentStep ??
      "crawl";
    return `${getWebCrawlStepLabel(step)} · ${percent}%`;
  }
  if (session.value.phase === "completed") {
    const pages =
      session.value.output?.markdownCount ??
      session.value.output?.totalPages ??
      0;
    return pages > 0
      ? `直近の取り込み: ${pages} ページを AI に登録しました`
      : "直近の取り込みが完了しました";
  }
  if (session.value.phase === "error") {
    return "直近の取り込みに失敗しました";
  }
  return "URL を入力して取り込みを開始できます";
});

const statusIcon = computed(() => {
  if (session.value.phase === "running") return "i-heroicons-arrow-path";
  if (session.value.phase === "error") return "i-heroicons-exclamation-triangle";
  if (session.value.phase === "completed") return "i-heroicons-check-circle";
  return "i-heroicons-globe-alt";
});

const statusIconSpin = computed(() => session.value.phase === "running");

const statusIconTone = computed(() => {
  if (session.value.phase === "error") return "text-rose-600";
  if (session.value.phase === "running") return "text-purple-600";
  if (session.value.phase === "completed") return "text-emerald-600";
  return "text-gray-500";
});

watch(
  () => session.value.phase,
  (phase, prev) => {
    if (prev === "running" && phase === "completed") {
      emit("completed");
    }
  }
);

const onImportClick = async () => {
  if (isSessionRunning.value) {
    webCrawlStore.openIngestProgressModal();
    return;
  }

  if (!canStartImport.value) return;
  const importFolder = selectedImportFolder.value;
  if (!importFolder) return;

  isStartingImport.value = true;
  try {
    const submitted = await submit({
      url: urlInput.value,
      maxDepth: maxDepth.value,
      maxUrls: maxUrls.value,
      description: description.value,
      importFolder,
    });
    if (submitted && selectedFolderId.value === NEW_FOLDER_ID) {
      selectedFolderId.value = importFolder.id;
      newFolderName.value = "";
      newFolderDescription.value = "";
    }
  } finally {
    isStartingImport.value = false;
  }
};
</script>
