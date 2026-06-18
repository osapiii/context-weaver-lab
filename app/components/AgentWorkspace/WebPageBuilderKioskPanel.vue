<template>
  <AiStudioStartKioskShell
    theme="webPage"
    mascot-message="作りたいLPの条件を教えてね&#10;要件設計からHTML出力まで進めるよ"
    mascot-alt="LP 作成 AI"
    title="作りたいLPの条件を入力"
    description="目的、ページタイプ、参考URLをもとに要件設計からHTML出力まで進めます。"
    test-id="web-page-builder-kiosk"
  >
    <form
      id="web-page-builder-kiosk-form"
      class="flex w-full flex-col gap-4"
      @submit.prevent="submit"
    >
      <UFormField label="制作目的">
        <UTextarea
          v-model="draftPurpose"
          :rows="5"
          placeholder="例: EN AI Studioの販促用LP。業務部門向けに、社内ナレッジ活用・文書作成・調査分析をまとめて紹介したい。"
          :disabled="disabled"
          class="w-full"
        />
      </UFormField>

      <UFormField label="ページタイプ">
        <USelect
          v-model="draftPageType"
          :items="pageTypeItems"
          :disabled="disabled"
          class="w-full"
        />
      </UFormField>

      <div class="flex flex-col gap-2">
        <span class="text-xs font-bold text-slate-700">参考WEBページ（最大3つ）</span>
        <UInput
          v-for="(_, index) in draftReferenceUrls"
          :key="index"
          v-model="draftReferenceUrls[index]"
          type="url"
          :placeholder="`https://example.com/reference-${index + 1}`"
          :disabled="disabled"
          class="w-full"
        />
      </div>

    </form>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <EnButton
          type="submit"
          form="web-page-builder-kiosk-form"
          color="primary"
          leading-icon="material-symbols:play-arrow"
          :disabled="disabled || !canSubmit"
          :loading="disabled"
        >
          作成開始
        </EnButton>
      </div>
    </template>
  </AiStudioStartKioskShell>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import AiStudioStartKioskShell from "@components/AiStudio/AiStudioStartKioskShell.vue";
import EnButton from "@components/EnButton.vue";
import {
  emptyWebPageBuilderFields,
  webPageFieldsComplete,
  type WebPageBuilderFields,
} from "@utils/webPageWorkspaceState";

const props = defineProps<{
  fields?: WebPageBuilderFields;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  submit: [fields: WebPageBuilderFields];
}>();

const initial = props.fields ?? emptyWebPageBuilderFields();
const draftPurpose = ref(initial.purpose);
const draftPageType = ref(initial.pageType);
const draftReferenceUrls = ref([
  initial.referenceUrls[0] ?? "",
  initial.referenceUrls[1] ?? "",
  initial.referenceUrls[2] ?? "",
]);

const pageTypeItems = [
  { label: "商品LP", value: "product_lp" },
  { label: "サービスLP", value: "service_lp" },
  { label: "概念紹介LP", value: "concept_lp" },
  { label: "キャンペーンLP", value: "campaign_lp" },
  { label: "採用LP", value: "recruit_lp" },
  { label: "その他", value: "other" },
];

watch(
  () => props.fields,
  (next) => {
    if (!next) return;
    draftPurpose.value = next.purpose;
    draftPageType.value = next.pageType;
    draftReferenceUrls.value = [
      next.referenceUrls[0] ?? "",
      next.referenceUrls[1] ?? "",
      next.referenceUrls[2] ?? "",
    ];
  }
);

const currentFields = computed<WebPageBuilderFields>(() => ({
  purpose: draftPurpose.value,
  pageType: draftPageType.value,
  referenceUrls: draftReferenceUrls.value,
}));

const canSubmit = computed(() => webPageFieldsComplete(currentFields.value));

const submit = (): void => {
  if (!canSubmit.value || props.disabled) return;
  emit("submit", currentFields.value);
};
</script>
