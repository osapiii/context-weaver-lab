<template>
  <AiStudioStartKioskShell
    theme="writing"
    mascot-message="最初に参考資料を見せてね&#10;入力項目はこちらで整理するよ"
    mascot-alt="書類記入 AI"
    title="参考資料"
    description="補助金申請書・会社項目シートなど、作成したい書類の元資料を追加してください。"
    test-id="writing-reference-kiosk-panel"
  >
    <WritingReferenceMenu
      variant="kiosk"
      :state="state"
      :accept-mime-types="acceptMimeTypes"
      :chip-icon-for="chipIconFor"
      :disable-confirm="disableConfirm"
      :is-uploading="isUploading"
      :streaming-hint="streamingHint"
      @open-knowledge="emit('open-knowledge')"
      @confirm="emit('confirm')"
      @edit="emit('edit')"
      @remove="(id) => emit('remove', id)"
      @upload-files="(files) => emit('upload-files', files)"
      @paste-from-clipboard="emit('paste-from-clipboard')"
    />
  </AiStudioStartKioskShell>
</template>

<script setup lang="ts">
import WritingReferenceMenu from "@components/AgentWorkspace/WritingReferenceMenu.vue";
import AiStudioStartKioskShell from "@components/AiStudio/AiStudioStartKioskShell.vue";
import type { WritingReferenceState } from "@models/writingForm";

defineProps<{
  state: WritingReferenceState;
  acceptMimeTypes: string;
  chipIconFor: (mimeType: string) => string;
  disableConfirm?: boolean;
  isUploading?: boolean;
  streamingHint?: string;
}>();

const emit = defineEmits<{
  "open-knowledge": [];
  confirm: [];
  edit: [];
  remove: [id: string];
  "upload-files": [files: File[]];
  "paste-from-clipboard": [];
}>();
</script>
