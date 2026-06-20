<template>
  <AiStudioStartKioskShell
    theme="applicationScan"
    mascot-message="対象アプリを巡回して&#10;URL一覧とスクリーンショットをSSOT化するよ"
    mascot-alt="Application Scan AI"
    title="スキャン対象アプリを入力"
    description="開始URL、必要なログイン情報、取得範囲を指定して、sitemapとスクリーンショットをArtifactに保存します。"
    test-id="application-scan-kiosk"
  >
    <form
      id="application-scan-kiosk-form"
      class="flex w-full flex-col gap-4"
      @submit.prevent="submit"
    >
      <UFormField label="開始URL">
        <UInput
          v-model="draft.startUrl"
          type="url"
          placeholder="https://example.com/app"
          :disabled="disabled"
          class="w-full"
        />
      </UFormField>

      <div class="grid gap-3 md:grid-cols-2">
        <UFormField label="ログインURL">
          <UInput
            v-model="draft.loginUrl"
            type="url"
            placeholder="https://example.com/login"
            :disabled="disabled"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Agent Search FileSpace ID">
          <UInput
            v-model="draft.fileSpaceId"
            placeholder="w-default"
            :disabled="disabled"
            class="w-full"
          />
        </UFormField>
      </div>

      <div class="grid gap-3 md:grid-cols-2">
        <UFormField label="ログインID">
          <UInput
            v-model="draft.username"
            autocomplete="username"
            placeholder="user@example.com"
            :disabled="disabled"
            class="w-full"
          />
        </UFormField>
        <UFormField label="パスワード">
          <UInput
            v-model="draft.password"
            type="password"
            autocomplete="current-password"
            placeholder="保存Artifactには出力しません"
            :disabled="disabled"
            class="w-full"
          />
        </UFormField>
      </div>

      <details class="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
        <summary class="cursor-pointer text-xs font-bold text-slate-700">
          詳細セレクタと巡回範囲
        </summary>
        <div class="mt-3 grid gap-3 md:grid-cols-3">
          <UFormField label="ID selector">
            <UInput
              v-model="draft.usernameSelector"
              placeholder="input[name=email]"
              :disabled="disabled"
            />
          </UFormField>
          <UFormField label="Password selector">
            <UInput
              v-model="draft.passwordSelector"
              placeholder="input[type=password]"
              :disabled="disabled"
            />
          </UFormField>
          <UFormField label="Submit selector">
            <UInput
              v-model="draft.submitSelector"
              placeholder="button[type=submit]"
              :disabled="disabled"
            />
          </UFormField>
        </div>
        <div class="mt-3 grid gap-3 md:grid-cols-2">
          <UFormField label="Include regex（改行区切り）">
            <UTextarea
              v-model="includeText"
              :rows="3"
              placeholder="/admin|/dashboard"
              :disabled="disabled"
            />
          </UFormField>
          <UFormField label="Exclude regex（改行区切り）">
            <UTextarea
              v-model="excludeText"
              :rows="3"
              placeholder="logout|delete|billing/checkout"
              :disabled="disabled"
            />
          </UFormField>
        </div>
      </details>

      <div class="grid gap-3 md:grid-cols-[10rem_1fr]">
        <UFormField label="最大ページ数">
          <input
            v-model.number="draft.maxPages"
            type="number"
            min="1"
            max="50"
            :disabled="disabled"
            class="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
          />
        </UFormField>
        <label class="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
          <UCheckbox
            v-model="draft.captureScreenshots"
            :disabled="disabled"
          />
          スクリーンショットを取得する
        </label>
      </div>
    </form>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <EnButton
          type="submit"
          form="application-scan-kiosk-form"
          color="primary"
          leading-icon="material-symbols:travel-explore"
          :disabled="disabled || !canSubmit"
          :loading="disabled"
        >
          スキャン開始
        </EnButton>
      </div>
    </template>
  </AiStudioStartKioskShell>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import AiStudioStartKioskShell from "@components/AiStudio/AiStudioStartKioskShell.vue";
import EnButton from "@components/EnButton.vue";
import {
  applicationScanFieldsComplete,
  emptyApplicationScanFields,
  type ApplicationScanFields,
} from "@utils/applicationScanWorkspaceState";

const props = defineProps<{
  fields?: ApplicationScanFields;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  submit: [fields: ApplicationScanFields];
}>();

const initial = props.fields ?? emptyApplicationScanFields();
const draft = reactive<ApplicationScanFields>({ ...initial });
const includeText = ref(initial.includePatterns.join("\n"));
const excludeText = ref(initial.excludePatterns.join("\n"));

const lines = (value: string): string[] =>
  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

watch(
  () => props.fields,
  (next) => {
    if (!next) return;
    Object.assign(draft, next);
    includeText.value = next.includePatterns.join("\n");
    excludeText.value = next.excludePatterns.join("\n");
  }
);

const currentFields = computed<ApplicationScanFields>(() => ({
  ...draft,
  includePatterns: lines(includeText.value),
  excludePatterns: lines(excludeText.value),
}));

const canSubmit = computed(() =>
  applicationScanFieldsComplete(currentFields.value)
);

const submit = (): void => {
  if (!canSubmit.value || props.disabled) return;
  emit("submit", currentFields.value);
};
</script>
