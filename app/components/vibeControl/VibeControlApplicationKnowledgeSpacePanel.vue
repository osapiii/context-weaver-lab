<template>
  <section class="rounded-lg border border-slate-200 bg-white p-5">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <h2 class="text-sm font-semibold text-slate-900">Knowledge Space</h2>
          <EnBadge
            :color="statusColor"
            variant="soft"
          >
            {{ statusLabel }}
          </EnBadge>
        </div>
        <p class="mt-1 text-xs text-slate-500">
          {{ application?.fileSpaceId || application?.fileSpaceCreateRequestId || "未作成" }}
        </p>
      </div>

      <div class="flex shrink-0 flex-wrap gap-2">
        <EnButton
          v-if="application && status !== 'ready'"
          variant="ai"
          size="sm"
          leading-icon="material-symbols:add-circle-outline"
          :loading="isProvisioning"
          :disabled="status === 'creating'"
          @click="$emit('create-file-space')"
        >
          {{ status === "error" ? "再作成" : "専用FileSpace作成" }}
        </EnButton>
        <EnButton
          variant="ghost"
          color="neutral"
          size="sm"
          leading-icon="material-symbols:refresh"
          @click="$emit('refresh')"
        >
          再読込
        </EnButton>
      </div>
    </div>

    <EnAlert
      v-if="!application"
      class="mt-4"
      color="warning"
      title="アプリケーションを選択してください"
    />

    <EnAlert
      v-else-if="status === 'missing'"
      class="mt-4"
      color="warning"
      title="このアプリ専用のFileSpaceがまだありません"
      description="録画・仕様書・QAメモをアプリごとに分離して蓄積するため、専用FileSpaceを作成してください。"
    />

    <EnAlert
      v-else-if="status === 'creating'"
      class="mt-4"
      color="info"
      title="FileSpaceを作成中です"
      :description="application.fileSpaceCreateRequestId"
    />

    <EnAlert
      v-else-if="status === 'error'"
      class="mt-4"
      color="error"
      title="FileSpace作成に失敗しました"
      :description="application.fileSpaceErrorMessage || '再作成してください'"
    />

    <div
      v-else
      class="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(320px,1.1fr)]"
    >
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <dl class="space-y-3 text-sm">
          <div>
            <dt class="text-xs font-medium text-slate-500">FileSpace ID</dt>
            <dd class="mt-1 break-all font-semibold text-slate-900">
              {{ application.fileSpaceId }}
            </dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-slate-500">Repository</dt>
            <dd class="mt-1 break-all font-semibold text-slate-900">
              {{ application.repoFullName }}
            </dd>
          </div>
          <div v-if="application.startUrl">
            <dt class="text-xs font-medium text-slate-500">Start URL</dt>
            <dd class="mt-1 break-all font-semibold text-slate-900">
              {{ application.startUrl }}
            </dd>
          </div>
        </dl>
      </div>

      <label
        class="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-5 text-center transition"
        :class="
          isDragging
            ? 'border-primary-400 bg-primary-50'
            : 'border-slate-300 bg-white hover:border-primary-300 hover:bg-slate-50'
        "
        @dragenter.prevent="isDragging = true"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="onDrop"
      >
        <input
          type="file"
          class="hidden"
          multiple
          :disabled="isUploading"
          @change="onFilePicked"
        >
        <UIcon
          name="material-symbols:upload-file-outline"
          class="h-8 w-8 text-slate-400"
        />
        <span class="mt-3 text-sm font-semibold text-slate-900">
          {{ isUploading ? "投入中" : "ファイルを投入" }}
        </span>
        <span class="mt-1 text-xs text-slate-500">
          仕様書、QAメモ、議事録、操作ログ
        </span>
      </label>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type {
  DecodedVibeControlApplication,
  VibeControlApplicationFileSpaceProvisioningStatus,
} from "@models/vibeControl";

const props = defineProps<{
  application: DecodedVibeControlApplication | null;
  isProvisioning: boolean;
  isUploading: boolean;
}>();

const emit = defineEmits<{
  "create-file-space": [];
  "upload-files": [files: File[]];
  refresh: [];
}>();

const isDragging = ref(false);

const status = computed<VibeControlApplicationFileSpaceProvisioningStatus>(() => {
  if (!props.application) return "missing";
  if (props.application.fileSpaceId?.trim()) return "ready";
  return props.application.fileSpaceProvisioningStatus ?? "missing";
});

const statusLabel = computed(() => {
  if (status.value === "ready") return "Ready";
  if (status.value === "creating") return "Creating";
  if (status.value === "error") return "Error";
  return "Missing";
});

const statusColor = computed<"neutral" | "success" | "warning" | "error">(() => {
  if (status.value === "ready") return "success";
  if (status.value === "creating") return "warning";
  if (status.value === "error") return "error";
  return "neutral";
});

function onDrop(event: DragEvent): void {
  isDragging.value = false;
  if (props.isUploading) return;
  const files = Array.from(event.dataTransfer?.files ?? []);
  if (files.length === 0) return;
  emit("upload-files", files);
}

function onFilePicked(event: Event): void {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  if (files.length > 0) {
    emit("upload-files", files);
  }
  input.value = "";
}
</script>
