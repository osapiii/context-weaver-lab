<template>
  <div v-if="enabled && sessionId">
    <div class="flex flex-shrink-0 items-center gap-0.5">
      <EnButton
        variant="ghost"
        size="xs"
        icon="material-symbols:database-outline"
        class="flex-shrink-0 text-violet-600 dark:text-violet-300"
        title="Session state (dev)"
        aria-label="Session state"
        @click="open = true"
      />
      <a
        v-if="firestoreConsoleUrl"
        :href="firestoreConsoleUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-violet-600 transition hover:bg-violet-50 hover:text-violet-700 dark:text-violet-300 dark:hover:bg-violet-950/40 dark:hover:text-violet-200"
        title="Firestore を開く (dev)"
        aria-label="Firestore を開く"
      >
        <UIcon name="material-symbols:database-search" class="h-4 w-4" />
      </a>
    </div>

    <EnModal
      v-model:open="open"
      title="Session state"
      :subtitle="sessionId"
      title-icon="material-symbols:database-outline"
      size="full"
      :fullscreen="true"
      header-variant="default"
      padding="sm"
      :ui="{
        overlay: 'z-[70]',
        content: 'z-[70]',
      }"
    >
      <div
        class="flex min-h-0 flex-1 flex-col gap-3"
        data-testid="adk-session-state-debug"
      >
        <div class="flex flex-wrap items-center gap-2">
          <EnButton
            variant="outline"
            size="xs"
            :loading="isLoading"
            icon="i-heroicons-arrow-path-20-solid"
            @click="refresh"
          >
            更新
          </EnButton>
          <span v-if="error" class="text-xs text-rose-600 dark:text-rose-400">
            {{ error }}
          </span>
          <span
            v-else-if="payload"
            class="text-xs text-neutral-500"
          >
            events: {{ payload.eventCount }}
            <span v-if="payload.lastUpdateTime">
              · {{ formatUpdatedAt(payload.lastUpdateTime) }}
            </span>
          </span>
        </div>

        <div
          v-if="payload?.imageStudioSummary"
          class="flex flex-wrap gap-2 rounded-lg border border-violet-200/80 bg-violet-50/60 px-3 py-2 text-[11px] text-violet-950"
        >
          <span class="font-semibold">画像スタジオ</span>
          <EnBadge
            :color="payload.imageStudioSummary.phase === 'retouch' ? 'warning' : 'neutral'"
            variant="soft"
            :label="`phase: ${payload.imageStudioSummary.phase}`"
          />
          <span v-if="payload.imageStudioSummary.primaryFilename">
            primary:
            <code class="rounded bg-white/80 px-1">{{
              payload.imageStudioSummary.primaryFilename
            }}</code>
          </span>
          <span>regions: {{ payload.imageStudioSummary.regionCount }}</span>
        </div>

        <div
          v-if="payload"
          class="grid min-h-0 flex-1 gap-3 lg:grid-cols-2"
          style="min-height: min(72vh, calc(100dvh - 11rem))"
        >
          <div class="flex min-h-0 flex-col">
            <div
              class="mb-1 flex flex-shrink-0 items-center justify-between gap-2"
            >
              <p
                class="text-[10px] font-semibold uppercase tracking-wide text-neutral-500"
              >
                state
              </p>
              <EnButton
                variant="outline"
                size="xs"
                :icon="
                  stateCopied
                    ? 'i-heroicons-check-20-solid'
                    : 'i-heroicons-clipboard-document-20-solid'
                "
                :label="stateCopied ? 'コピー済み' : 'JSONをコピー'"
                :disabled="!stateJsonText"
                data-testid="adk-session-state-copy"
                @click="onCopyStateJson"
              />
            </div>
            <div
              class="jv-debug-panel min-h-0 flex-1 overflow-auto rounded-lg bg-neutral-50 p-2 ring-1 ring-neutral-200 dark:bg-neutral-950 dark:ring-neutral-800"
            >
              <JsonViewer
                :value="payload.state"
                :expand-depth="2"
                :copyable="false"
                :boxed="true"
                theme="light"
                class="text-[11px]"
              />
            </div>
          </div>
          <div class="flex min-h-0 flex-col">
            <div
              class="mb-1 flex flex-shrink-0 items-center justify-between gap-2"
            >
              <p
                class="text-[10px] font-semibold uppercase tracking-wide text-neutral-500"
              >
                recent events ({{ payload.events.length }})
              </p>
              <EnButton
                variant="outline"
                size="xs"
                :icon="
                  eventsCopied
                    ? 'i-heroicons-check-20-solid'
                    : 'i-heroicons-clipboard-document-20-solid'
                "
                :label="eventsCopied ? 'コピー済み' : 'JSONをコピー'"
                :disabled="!eventsJsonText"
                data-testid="adk-session-events-copy"
                @click="onCopyEventsJson"
              />
            </div>
            <div
              class="jv-debug-panel min-h-0 flex-1 overflow-auto rounded-lg bg-neutral-50 p-2 ring-1 ring-neutral-200 dark:bg-neutral-950 dark:ring-neutral-800"
            >
              <JsonViewer
                :value="payload.events"
                :expand-depth="1"
                :copyable="false"
                :boxed="true"
                theme="light"
                class="text-[11px]"
              />
            </div>
          </div>
        </div>
        <p
          v-else-if="!isLoading && !error"
          class="text-xs text-neutral-500"
        >
          Firestore に session がまだありません（初回送信後に表示されます）
        </p>
      </div>
    </EnModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import EnBadge from "@components/EnBadge.vue";
import EnModal from "@components/EnModal.vue";
import {
  useAdkSessionDebug,
  type AdkSessionDebugPayload,
} from "@composables/useAdkSessionDebug";
import { tryResolveAdkSessionScope } from "@composables/useAdkSessionScope";
import { firebaseFirestoreDocumentConsoleUrl } from "@utils/firebaseConsoleLinks";
import { JsonViewer } from "vue3-json-viewer";
import { formatJsonForDebugDisplay } from "@utils/jsonDebugDisplay";

const props = defineProps<{
  sessionId: string;
  refreshToken?: number;
}>();

const enabled = computed(() => import.meta.dev);
const open = ref(false);
const { fetchSession } = useAdkSessionDebug();
const runtimeConfig = useRuntimeConfig();
const isLoading = ref(false);
const error = ref("");
const payload = ref<AdkSessionDebugPayload | null>(null);

const toast = useToast();
const stateCopied = ref(false);
const eventsCopied = ref(false);

const stateJsonText = computed(() =>
  payload.value ? formatJsonForDebugDisplay(payload.value.state) : ""
);

const eventsJsonText = computed(() =>
  payload.value ? formatJsonForDebugDisplay(payload.value.events) : ""
);

const firestoreConsoleUrl = computed(() => {
  if (!enabled.value || !props.sessionId) return null;

  const scope = tryResolveAdkSessionScope();
  const projectId = runtimeConfig.public.firebase?.projectId?.trim() || "";
  if (!scope || !projectId) return null;

  return firebaseFirestoreDocumentConsoleUrl({
    projectId,
    pathSegments: [
      "organizations",
      scope.organizationId,
      "spaces",
      scope.spaceId,
      "adkSessions",
      props.sessionId,
    ],
  });
});

const copyJsonToClipboard = async (
  text: string,
  copiedFlag: { value: boolean }
): Promise<void> => {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    copiedFlag.value = true;
    window.setTimeout(() => {
      copiedFlag.value = false;
    }, 2000);
    toast.add({ title: "クリップボードにコピーしました", color: "success" });
  } catch {
    toast.add({
      title: "コピーに失敗しました",
      description: "ブラウザのクリップボード権限を確認してください",
      color: "error",
    });
  }
};

const onCopyStateJson = (): void => {
  void copyJsonToClipboard(stateJsonText.value, stateCopied);
};

const onCopyEventsJson = (): void => {
  void copyJsonToClipboard(eventsJsonText.value, eventsCopied);
};

const formatUpdatedAt = (unixSeconds: number): string => {
  const date = new Date(unixSeconds * 1000);
  return date.toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const refresh = async (): Promise<void> => {
  if (!props.sessionId) return;
  isLoading.value = true;
  error.value = "";
  try {
    payload.value = await fetchSession(props.sessionId);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "取得に失敗しました";
    payload.value = null;
  } finally {
    isLoading.value = false;
  }
};

watch(open, (isOpen) => {
  if (isOpen && props.sessionId && !isLoading.value) {
    void refresh();
  }
});

watch(
  () => [props.sessionId, props.refreshToken] as const,
  ([sessionId]) => {
    if (!sessionId) {
      payload.value = null;
      open.value = false;
    } else if (open.value) {
      void refresh();
    }
  }
);
</script>

<style scoped>
.jv-debug-panel :deep(.jv-container) {
  background: transparent;
}
.jv-debug-panel :deep(.jv-container.boxed) {
  border: none;
}
</style>
