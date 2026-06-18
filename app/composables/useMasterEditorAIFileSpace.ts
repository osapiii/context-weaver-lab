import { computed, ref, watch } from "vue";
import { useToast } from "#imports";
import log from "@utils/logger";
import type { AttachedFile } from "@adapters/masterEditor/types";
import { useDefaultFileSpace } from "@composables/useDefaultFileSpace";
import { useGeminiFileSpaceOperatorStore } from "@stores/geminiFileSpaceOperator";
import { useOrganizationStore } from "@stores/organization";
import { useSpaceStore } from "@stores/space";
import { useContextStore } from "@stores/context";
import { useGeminiFileSpaceSnapshot } from "@composables/useGeminiFileSpaceSnapshot";
import { manualUploadRelativePath } from "@utils/knowledgeStoragePaths";
import { summarizeKnowledgeDocumentsForWelcome } from "@utils/knowledgeWelcomeSummary";

export function useMasterEditorAIFileSpace() {
  const toast = useToast();
  const attachedFiles = ref<AttachedFile[]>([]);
  const fileInputRef = ref<HTMLInputElement | null>(null);
  const isUploading = ref(false);
  const pickerOpen = ref(false);

  const organizationStore = useOrganizationStore();
  const spaceStore = useSpaceStore();
  const contextStore = useContextStore();
  const fileSpaceStore = useGeminiFileSpaceOperatorStore();
  const {
    fileSpaceId,
    isLoading: isLoadingFileSpace,
    error: fileSpaceError,
  } = useDefaultFileSpace();

  const acceptableMimeTypes =
    ".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.csv,.tsv,.json,.md,.xlsx,.xls,.docx,.doc";

  const chipIconFor = (mime: string): string => {
    const m = (mime || "").toLowerCase();
    if (m.includes("pdf")) return "vscode-icons:file-type-pdf2";
    if (m.includes("sheet") || m.includes("excel"))
      return "vscode-icons:file-type-excel";
    if (m.includes("image")) return "material-symbols:image-outline";
    if (m.includes("csv")) return "vscode-icons:file-type-csv";
    if (m.includes("word") || m.includes("document"))
      return "vscode-icons:file-type-word";
    return "material-symbols:description-outline";
  };

  const isFileSpaceConnected = computed(
    () =>
      !!fileSpaceId.value && !isLoadingFileSpace.value && !fileSpaceError.value
  );

  const documentCount = computed(() => fileSpaceStore.documents?.length ?? 0);

  watch(
    fileSpaceId,
    async (newId) => {
      if (!newId) return;
      try {
        await fileSpaceStore.fetchDocumentsFromFirestore(newId);
      } catch (e) {
        log("ERROR", "useMasterEditorAIFileSpace: fetchDocuments failed", e);
      }
    },
    { immediate: true }
  );

  const fileSpaceBadgeClass = computed(() => {
    if (isFileSpaceConnected.value) {
      return "bg-violet-50 text-violet-700 ring-1 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-800/50";
    }
    if (fileSpaceError.value) {
      return "bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-800/50";
    }
    return "bg-purple-50 text-purple-700 ring-1 ring-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:ring-purple-800/50";
  });

  const fileSpaceDotClass = computed(() => {
    if (isFileSpaceConnected.value) return "bg-violet-500 animate-pulse";
    if (fileSpaceError.value) return "bg-red-500";
    return "bg-purple-400 animate-pulse";
  });

  const fileSpaceBadgeTitle = computed(() => {
    if (isFileSpaceConnected.value) {
      return `資料 ${documentCount.value}件`;
    }
    if (fileSpaceError.value) {
      return `未接続: ${fileSpaceError.value}`;
    }
    if (isLoadingFileSpace.value) {
      return "接続中";
    }
    return "未接続";
  });

  const welcomeFileSpaceCardClass = computed(() => {
    if (isFileSpaceConnected.value) {
      return "border-violet-200 bg-violet-50/60 text-violet-900 dark:border-violet-800/50 dark:bg-violet-950/20 dark:text-violet-100";
    }
    if (fileSpaceError.value) {
      return "border-red-200 bg-red-50/60 text-red-900 dark:border-red-800/50 dark:bg-red-950/20 dark:text-red-100";
    }
    return "border-purple-200 bg-purple-50/60 text-purple-900 dark:border-purple-800/50 dark:bg-purple-950/20 dark:text-purple-100";
  });

  const welcomeFileSpaceIcon = computed(() => {
    if (isFileSpaceConnected.value)
      return "material-symbols:library-books-outline";
    if (fileSpaceError.value) return "material-symbols:wifi-off";
    return "material-symbols:cloud-sync-outline";
  });

  const welcomeFileSpaceIconClass = computed(() => {
    if (isFileSpaceConnected.value)
      return "text-violet-600 dark:text-violet-400";
    if (fileSpaceError.value) return "text-red-600 dark:text-red-400";
    return "text-purple-600 dark:text-purple-400 animate-pulse";
  });

  const welcomeFileSpaceTitle = computed(() => {
    if (isFileSpaceConnected.value) {
      return `社内ドキュメント ${documentCount.value} 件 を把握済み`;
    }
    if (fileSpaceError.value) return "社内資料への接続が切れた…";
    return "社内資料を読み取り中…";
  });

  const welcomeFileSpaceCategories = computed(() =>
    summarizeKnowledgeDocumentsForWelcome(fileSpaceStore.documents ?? [])
  );

  const welcomeFileSpaceDescription = computed(() => {
    if (isFileSpaceConnected.value) {
      if (documentCount.value === 0) {
        return "まだ素材プールに資料はゼロだけど、いつでも参照する準備はできてるよ";
      }
      if (welcomeFileSpaceCategories.value.length > 0) {
        return "カテゴリごとの社内資料を見ながら答えるよ";
      }
      return "組織が貯めてきた資料を見ながら答えるよ";
    }
    if (fileSpaceError.value) return "再読み込みすると復帰するかも";
    return "もうすぐスタンバイ完了";
  });

  const attachMenuItems = computed(() => [
    {
      label: "ファイルをアップロード",
      icon: "material-symbols:upload",
      disabled: !isFileSpaceConnected.value || isUploading.value,
      onSelect: () => {
        if (fileInputRef.value) {
          fileInputRef.value.value = "";
          fileInputRef.value.click();
        }
      },
    },
    {
      label: "既存資料から選ぶ",
      icon: "i-heroicons-magnifying-glass",
      disabled: !isFileSpaceConnected.value,
      onSelect: () => {
        pickerOpen.value = true;
      },
    },
  ]);

  const removeAttachment = (index: number): void => {
    attachedFiles.value.splice(index, 1);
  };

  const onPickerAttach = (files: AttachedFile[]): void => {
    if (files.length === 0) {
      toast.add({ title: "添付対象がありません", color: "warning" });
      return;
    }
    attachedFiles.value.push(...files);
    toast.add({
      title: `${files.length} 件の資料を添付しました`,
      color: "success",
    });
  };

  const clearAttachments = (): void => {
    attachedFiles.value = [];
  };

  const takeAttachmentsSnapshot = (): AttachedFile[] => [...attachedFiles.value];

  const uploadLocalFiles = async (
    files: File[],
    options?: { attachToChat?: boolean }
  ): Promise<AttachedFile[]> => {
    const attachToChat = options?.attachToChat ?? true;

    if (!fileSpaceId.value) {
      throw new Error("FileSpace が未接続です。設定から接続してください。");
    }

    const organizationId = organizationStore.getLoggedInOrganizationId;
    const spaceId = spaceStore.selectedSpace?.id;
    if (!organizationId || !spaceId) {
      throw new Error("組織 / スペースが未選択です");
    }

    isUploading.value = true;
    try {
      const uploaded: AttachedFile[] = [];
      for (const file of files) {
        const requestDoc = await fileSpaceStore.uploadFileToFileSpace({
          storeId: fileSpaceId.value,
          file,
          organizationId,
          spaceId,
        });
        if (!requestDoc) throw new Error("upload returned null");

        useGeminiFileSpaceSnapshot(requestDoc.id, async () => {
          await fileSpaceStore.fetchDocumentsFromFirestore(fileSpaceId.value!);
        });

        const gcsPath = contextStore.baseGcsPath(
          manualUploadRelativePath({
            fileSpaceId: fileSpaceId.value!,
            fileName: file.name,
          })
        );
        uploaded.push({
          gcsPath,
          mimeType: file.type || "application/octet-stream",
          fileName: file.name,
        });
      }

      if (uploaded.length > 0 && attachToChat) {
        attachedFiles.value.push(...uploaded);
        toast.add({
          title: `${uploaded.length} 件のファイルを添付しました`,
          color: "success",
        });
      }

      return uploaded;
    } finally {
      isUploading.value = false;
    }
  };

  const onFilesSelected = async (event: Event): Promise<void> => {
    const target = event.target as HTMLInputElement;
    const files = target.files;
    if (!files || files.length === 0) return;

    try {
      await uploadLocalFiles(Array.from(files), { attachToChat: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.add({ title: "アップロードに失敗", description: msg, color: "error" });
    } finally {
      if (target) target.value = "";
    }
  };

  return {
    attachedFiles,
    fileInputRef,
    isUploading,
    pickerOpen,
    fileSpaceStore,
    fileSpaceId,
    acceptableMimeTypes,
    chipIconFor,
    isFileSpaceConnected,
    isLoadingFileSpace,
    documentCount,
    fileSpaceBadgeClass,
    fileSpaceDotClass,
    fileSpaceBadgeTitle,
    welcomeFileSpaceCardClass,
    welcomeFileSpaceIcon,
    welcomeFileSpaceIconClass,
    welcomeFileSpaceTitle,
    welcomeFileSpaceDescription,
    welcomeFileSpaceCategories,
    attachMenuItems,
    removeAttachment,
    onPickerAttach,
    onFilesSelected,
    uploadLocalFiles,
    clearAttachments,
    takeAttachmentsSnapshot,
  };
}
