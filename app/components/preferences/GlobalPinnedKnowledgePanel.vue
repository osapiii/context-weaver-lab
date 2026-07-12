<template>
  <div class="space-y-4">
    <div
      v-if="fileSpaceLoading"
      class="space-y-2"
      aria-busy="true"
      aria-label="ピン留め資料を読み込み中"
    >
      <div
        v-for="i in 3"
        :key="i"
        class="flex items-center gap-3 rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2"
      >
        <USkeleton class="h-10 w-10 rounded-lg" />
        <div class="min-w-0 flex-1 space-y-1.5">
          <USkeleton class="h-4 w-2/3 rounded" />
          <USkeleton class="h-3 w-full rounded" />
        </div>
        <USkeleton class="h-6 w-6 rounded" />
      </div>
    </div>
    <div
      v-else-if="fileSpaceError"
      class="rounded-md bg-purple-50 px-3 py-2 text-sm text-purple-800"
    >
      {{ fileSpaceError }}
    </div>

    <template v-else>
      <div
        v-if="pinnedDraft.length === 0"
        class="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500"
      >
        ピン留めされた資料はありません
      </div>
      <ul
        v-else
        class="space-y-2"
      >
        <li
          v-for="item in pinnedDraft"
          :key="item.id"
          class="flex items-center gap-3 rounded-lg border border-purple-100 bg-purple-50/50 px-3 py-2"
        >
          <button
            type="button"
            class="flex min-w-0 flex-1 items-center gap-3 text-left transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-400"
            :title="`${item.name} · クリックでプレビュー`"
            @click="openPinnedPreview(item)"
          >
            <ConsultationKnowledgeListThumb
              v-if="documentFor(item.id)"
              :document="documentFor(item.id)!"
            />
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-neutral-800">
                {{ item.name }}
              </p>
              <p class="truncate text-[10px] text-neutral-500">
                {{ item.gcsPath }}
              </p>
            </div>
          </button>
          <button
            type="button"
            class="rounded p-1 text-neutral-400 hover:bg-purple-100 hover:text-neutral-700"
            title="ピン留め解除"
            @click="removePinned(item.id)"
          >
            <UIcon name="material-symbols:close" class="h-4 w-4" />
          </button>
        </li>
      </ul>

      <div class="flex flex-wrap gap-2">
        <EnButton
          variant="outline"
          size="sm"
          leading-icon="material-symbols:menu-book-outline"
          :disabled="!isFileSpaceReady"
          @click="pickerOpen = true"
        >
          資料を選んでピン留め
        </EnButton>
        <EnButton
          variant="solid"
          color="primary"
          size="sm"
          leading-icon="material-symbols:save"
          :disabled="pinnedSaving"
          @click="savePinned"
        >
          ピン留めを保存
        </EnButton>
      </div>

      <div
        v-if="pinnedError"
        class="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700"
      >
        ⚠️ {{ pinnedError }}
      </div>
      <div
        v-if="pinnedSuccess"
        class="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
      >
        ✓ {{ pinnedSuccess }}
      </div>
    </template>

    <KnowledgePickerModal
      v-model:open="pickerOpen"
      v-model="pinnedDraft"
      mode="global-pinned"
      :documents="documents"
      :is-loading="fileSpaceLoading"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import ConsultationKnowledgeListThumb from "@components/AgentWorkspace/ConsultationKnowledgeListThumb.vue";
import KnowledgePickerModal from "@components/knowledge/KnowledgePickerModal.vue";
import EnButton from "@components/EnButton.vue";
import { useKnowledgePreview } from "@composables/useKnowledgePreview";
import { useDefaultFileSpace } from "@composables/useDefaultFileSpace";
import { useGeminiFileSpaceOperatorStore } from "@stores/geminiFileSpaceOperator";
import { useAiUserSettingsStore } from "@stores/ai-user-settings";
import {
  knowledgeDocumentKey,
  type SelectedKnowledgeRef,
} from "@utils/consultationKnowledge";

const aiUserSettings = useAiUserSettingsStore();
const fileSpaceStore = useGeminiFileSpaceOperatorStore();
const { fileSpaceId, isLoading: fileSpaceLoading, error: fileSpaceError } =
  useDefaultFileSpace();

const pinnedDraft = ref<SelectedKnowledgeRef[]>([]);
const pickerOpen = ref(false);
const pinnedSaving = ref(false);
const pinnedError = ref<string | null>(null);
const pinnedSuccess = ref<string | null>(null);

const documents = computed(() => fileSpaceStore.documents ?? []);

const isFileSpaceReady = computed(
  () => Boolean(fileSpaceId.value) && !fileSpaceLoading.value && !fileSpaceError.value
);

watch(fileSpaceId, async (id) => {
  if (!id) return;
  try {
    await fileSpaceStore.fetchDocumentsFromFirestore(id);
  } catch {
    // 一覧取得失敗時はピッカー内で空表示
  }
});

const documentFor = (id: string) =>
  documents.value.find((doc) => knowledgeDocumentKey(doc) === id) ?? null;

const { openFromRef: openKnowledgePreviewFromRef } = useKnowledgePreview();

const openPinnedPreview = (item: SelectedKnowledgeRef): void => {
  openKnowledgePreviewFromRef(item, documents.value);
};

const removePinned = (id: string): void => {
  pinnedDraft.value = pinnedDraft.value.filter((item) => item.id !== id);
};

const loadPinned = async (): Promise<void> => {
  pinnedError.value = null;
  try {
    pinnedDraft.value = await aiUserSettings.loadPinnedKnowledge(true);
  } catch (e) {
    pinnedError.value = e instanceof Error ? e.message : String(e);
  }
};

const savePinned = async (): Promise<void> => {
  pinnedSaving.value = true;
  pinnedError.value = null;
  pinnedSuccess.value = null;
  try {
    await aiUserSettings.savePinnedKnowledge(pinnedDraft.value);
    pinnedSuccess.value = "ピン留め参照知識を保存しました";
  } catch (e) {
    pinnedError.value = e instanceof Error ? e.message : String(e);
  } finally {
    pinnedSaving.value = false;
  }
};

onMounted(() => {
  void loadPinned();
});

defineExpose({ reload: loadPinned });
</script>
