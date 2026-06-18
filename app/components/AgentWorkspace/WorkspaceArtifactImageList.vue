<template>
  <div
    class="flex min-h-full flex-col gap-4 bg-gradient-to-b from-purple-50/40 via-[#f6f6f7] to-[#f6f6f7] p-4 sm:p-6"
    data-testid="workspace-artifact-image-list"
  >
    <header class="flex flex-wrap items-end justify-between gap-2">
      <div>
        <p
          class="text-[10px] font-semibold uppercase tracking-[0.12em] text-purple-800/80"
        >
          OUT · 画像スタジオ
        </p>
        <h2 class="text-sm font-bold text-slate-900">
          生成画像
          <span class="ml-1 text-xs font-medium text-slate-500">
            （{{ entries.length }}）
          </span>
        </h2>
      </div>
      <p class="text-[11px] text-slate-600">
        プレビューまたはレタッチの起点に使う画像を選んでください
      </p>
    </header>

    <div
      class="grid grid-cols-1 gap-3 sm:grid-cols-2"
      :class="entries.length >= 3 ? 'lg:grid-cols-3' : ''"
    >
      <EnCard
        v-for="entry in entries"
        :key="entry.meta.key"
        variant="selectable"
        padding="compact"
        :selected="entry.meta.key === selectedKey"
        class="group overflow-hidden"
        :data-testid="`workspace-artifact-image-card-${entry.meta.key}`"
      >
        <div class="flex flex-col gap-2">
          <button
            type="button"
            class="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-white ring-1 ring-neutral-200/80 transition hover:ring-purple-300/80"
            @click="emit('preview', entry)"
          >
            <AdkArtifactImage
              :artifact-id="entry.artifact.artifactId"
              :url="entry.artifact.url"
              :transient-display-url="entry.artifact.transientDisplayUrl"
              :adk-filename="entry.artifact.adkFilename"
              :artifact-version="entry.artifact.artifactVersion"
              :session-id="sessionId ?? undefined"
              :alt="entry.meta.title"
              class="h-full w-full object-cover transition group-hover:scale-[1.02]"
            />
            <div class="absolute left-2 top-2 flex flex-wrap gap-1">
              <EnBadge
                color="warning"
                variant="soft"
                :label="`v${entry.artifact.artifactVersion ?? 0}`"
              />
              <EnBadge
                v-if="isPrimaryEntry(entry)"
                variant="ai"
                label="レタッチ対象"
              />
            </div>
          </button>

          <div class="min-w-0">
            <p class="truncate text-xs font-semibold text-slate-900">
              {{ entry.meta.title }}
            </p>
            <p class="text-[10px] text-slate-500">
              タップでプレビュー
            </p>
          </div>

          <div class="flex flex-wrap gap-1.5">
            <EnButton
              variant="outline"
              size="xs"
              class="min-h-8 flex-1"
              data-testid="workspace-artifact-image-preview"
              @click.stop="emit('preview', entry)"
            >
              プレビュー
            </EnButton>
            <EnButton
              variant="ai"
              size="xs"
              class="min-h-8 flex-1"
              data-testid="workspace-artifact-image-retouch"
              :disabled="disabled || !entry.artifact.adkFilename?.trim()"
              @click.stop="emit('retouch', entry)"
            >
              レタッチ
            </EnButton>
          </div>
        </div>
      </EnCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import AdkArtifactImage from "@components/AgentWorkspace/AdkArtifactImage.vue";
import EnBadge from "@components/EnBadge.vue";
import EnButton from "@components/EnButton.vue";
import EnCard from "@components/EnCard.vue";
import type { WorkspaceArtifactEntry } from "@composables/useWorkspaceArtifactPanel";
import {
  imagePrimaryMatchesArtifact,
  type ImagePrimaryArtifact,
} from "@utils/imageStudioState";

const props = defineProps<{
  entries: WorkspaceArtifactEntry[];
  selectedKey: string | null;
  sessionId?: string | null;
  primary: ImagePrimaryArtifact;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  preview: [entry: WorkspaceArtifactEntry];
  retouch: [entry: WorkspaceArtifactEntry];
}>();

const isPrimaryEntry = (entry: WorkspaceArtifactEntry): boolean =>
  imagePrimaryMatchesArtifact({
    primary: props.primary,
    artifactId: entry.artifact.artifactId,
    adkFilename: entry.artifact.adkFilename,
  });
</script>
