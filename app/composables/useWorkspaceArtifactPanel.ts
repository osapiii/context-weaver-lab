import { computed, ref, watch, type Ref } from "vue";
import type { AgentSseArtifact } from "@composables/useAgentSseClient";
import type { AiStudioMessage } from "@stores/aiStudio";
import {
  isPanelPrimaryArtifact,
  workspaceArtifactKey,
  workspaceArtifactMeta,
  type WorkspaceArtifactMeta,
} from "@utils/workspaceArtifactMeta";

export interface WorkspaceArtifactEntry {
  artifact: AgentSseArtifact;
  messageId: string;
  index: number;
  meta: WorkspaceArtifactMeta;
}

export const WORKSPACE_ARTIFACT_PANEL_KEY = Symbol("workspaceArtifactPanel");

export const useWorkspaceArtifactPanel = (params: {
  messages: Ref<AiStudioMessage[]>;
  sessionId: Ref<string | null>;
}) => {
  const selectedKey = ref<string | null>(null);
  const panelOpen = ref(false);
  /** 画像スタジオ: ギャラリー一覧 ↔ 単一プレビュー */
  const imageViewMode = ref<"list" | "focus">("list");

  const entries = computed<WorkspaceArtifactEntry[]>(() => {
    const out: WorkspaceArtifactEntry[] = [];
    for (const message of params.messages.value) {
      if (!message?.artifacts?.length) continue;
      message.artifacts.forEach((artifact, index) => {
        if (!artifact) return;
        if (!isPanelPrimaryArtifact(artifact)) return;
        out.push({
          artifact,
          messageId: message.id,
          index,
          meta: workspaceArtifactMeta({
            artifact,
            messageId: message.id,
            index,
          }),
        });
      });
    }
    return out;
  });

  const selectedEntry = computed(() => {
    if (!selectedKey.value) return null;
    return (
      entries.value.find((entry) => entry.meta.key === selectedKey.value) ??
      null
    );
  });

  const selectedIndex = computed(() => {
    if (!selectedKey.value) return -1;
    return entries.value.findIndex((entry) => entry.meta.key === selectedKey.value);
  });

  const selectLatestKey = (): void => {
    const last = entries.value[entries.value.length - 1];
    if (last) selectedKey.value = last.meta.key;
  };

  const openImageGallery = (): void => {
    imageViewMode.value = "list";
  };

  const openImageFocus = (): void => {
    imageViewMode.value = "focus";
  };

  const selectLatestAndOpen = (): void => {
    selectLatestKey();
    if (!selectedKey.value) return;
    panelOpen.value = true;
    const entry = entries.value.find((item) => item.meta.key === selectedKey.value);
    if (entry?.meta.panelKind === "image") {
      imageViewMode.value = "focus";
    }
  };

  const selectByKey = (key: string | null): void => {
    if (!key) {
      selectedKey.value = null;
      return;
    }
    const exists = entries.value.some((entry) => entry.meta.key === key);
    if (!exists) return;
    selectedKey.value = key;
    panelOpen.value = true;
  };

  const selectLatest = (): void => {
    selectLatestAndOpen();
  };

  const selectRelative = (delta: number): void => {
    if (entries.value.length === 0) return;
    const current = selectedIndex.value;
    const next =
      current < 0
        ? delta > 0
          ? 0
          : entries.value.length - 1
        : (current + delta + entries.value.length) % entries.value.length;
    selectedKey.value = entries.value[next]!.meta.key;
    panelOpen.value = true;
  };

  const openPanel = (): void => {
    panelOpen.value = true;
    if (!selectedKey.value && entries.value.length > 0) {
      selectLatestKey();
    }
  };

  const closePanel = (): void => {
    panelOpen.value = false;
    imageViewMode.value = "list";
  };

  /** -1 = 初回同期（セッション読込）で自動展開しない */
  let previousCount = -1;

  watch(
    () => entries.value.length,
    (count) => {
      if (count === 0) {
        selectedKey.value = null;
        panelOpen.value = false;
        previousCount = 0;
        return;
      }

      if (previousCount < 0) {
        previousCount = count;
        return;
      }

      if (count > previousCount) {
        selectLatestAndOpen();
      } else if (
        selectedKey.value &&
        !entries.value.some((entry) => entry.meta.key === selectedKey.value)
      ) {
        if (panelOpen.value) selectLatestAndOpen();
        else selectLatestKey();
      }
      previousCount = count;
    },
    { immediate: true }
  );

  watch(
    () => params.sessionId.value,
    () => {
      selectedKey.value = null;
      panelOpen.value = false;
      imageViewMode.value = "list";
      previousCount = -1;
    }
  );

  return {
    entries,
    selectedKey,
    selectedEntry,
    selectedIndex,
    panelOpen,
    imageViewMode,
    selectByKey,
    selectLatest,
    selectRelative,
    openPanel,
    closePanel,
    openImageGallery,
    openImageFocus,
    sessionId: params.sessionId,
  };
};

export type WorkspaceArtifactPanelApi = ReturnType<typeof useWorkspaceArtifactPanel>;
