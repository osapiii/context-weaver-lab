<!--
  @deprecated 直接 import せず KnowledgePickerModal mode="consultation-turn" を使う.
  既存 import 互換の薄いラッパー.
-->
<template>
  <KnowledgePickerModal
    v-model:open="modalOpen"
    v-model="modelValue"
    mode="consultation-turn"
    :documents="documents"
    :is-loading="isLoading"
    :max-selection="maxSelection"
  />
</template>

<script setup lang="ts">
import type { Document } from "@models/document";
import KnowledgePickerModal from "@components/knowledge/KnowledgePickerModal.vue";
import {
  MAX_SELECTED_KNOWLEDGE,
  type SelectedKnowledgeRef,
} from "@utils/consultationKnowledge";

withDefaults(
  defineProps<{
    documents: Document[];
    isLoading?: boolean;
    maxSelection?: number;
  }>(),
  {
    isLoading: false,
    maxSelection: MAX_SELECTED_KNOWLEDGE,
  }
);

const modelValue = defineModel<SelectedKnowledgeRef[]>({ required: true });
const modalOpen = defineModel<boolean>("open", { default: false });
</script>
