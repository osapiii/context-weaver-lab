<template>
  <div class="space-y-6">
    <EnAlert variant="ai" title="Godモード — SaaS アカウント発行">
      <p class="text-sm leading-relaxed">
        新規顧客のオンボーディング用です。メール・パスワード・組織情報を入力すると、
        組織作成・Space 作成・Firebase Auth ユーザー作成・FileSpace 初期設定を一括実行します。
      </p>
      <p class="mt-2 text-xs opacity-80">
        操作者組織: {{ operatorOrganizationCode }}
      </p>
    </EnAlert>

    <EnCard variant="default" padding="spacious">
      <form class="space-y-5" @submit.prevent="onSubmit">
        <div class="grid gap-5 md:grid-cols-2">
          <UFormField label="新規ユーザーのメールアドレス" required>
            <UInput
              v-model="form.email"
              type="email"
              placeholder="customer@example.com"
              class="w-full"
              :disabled="isBusy"
            />
          </UFormField>

          <UFormField label="初期パスワード" required>
            <UInput
              v-model="form.password"
              type="password"
              placeholder="6文字以上"
              class="w-full"
              :disabled="isBusy"
            />
          </UFormField>

          <UFormField label="組織名" required>
            <UInput
              v-model="form.organizationName"
              placeholder="株式会社サンプル"
              class="w-full"
              :disabled="isBusy"
              @blur="maybeSuggestOrgCode"
            />
          </UFormField>

          <UFormField label="組織コード" required hint="英数字・ハイフン・アンダースコア">
            <UInput
              v-model="form.organizationCode"
              placeholder="SAMPLE_CORP"
              class="w-full font-mono uppercase"
              :disabled="isBusy"
              @input="form.organizationCode = form.organizationCode.toUpperCase()"
            />
          </UFormField>

          <UFormField label="初期 Space 名">
            <UInput
              v-model="form.spaceName"
              placeholder="メイン"
              class="w-full"
              :disabled="isBusy"
            />
          </UFormField>

          <UFormField label="ユーザーロール">
            <EnSelectMenu
              v-model="form.rbacRole"
              :items="roleOptions"
              value-key="value"
              class="w-full"
              :disabled="isBusy"
            />
          </UFormField>
        </div>

        <div class="flex flex-wrap items-center gap-3 pt-2">
          <EnButton
            variant="ai"
            type="submit"
            :loading="isBusy"
            :disabled="!isFormValid || isBusy"
            leading-icon="material-symbols:rocket-launch"
          >
            アカウントを発行する
          </EnButton>
          <EnButton
            v-if="activeRequestId"
            variant="ghost"
            type="button"
            :disabled="isBusy"
            @click="resetForm"
          >
            フォームをリセット
          </EnButton>
        </div>
      </form>
    </EnCard>

    <!-- 進捗表示 -->
    <EnCard v-if="activeRequest" variant="flat" padding="snug">
      <div class="mb-3 flex items-center justify-between gap-2">
        <h3 class="font-semibold">実行状況</h3>
        <EnBadge
          :variant="statusBadgeVariant"
          :color="statusBadgeColor"
        >
          {{ statusLabel }}
        </EnBadge>
      </div>

      <div v-if="activeRequest.errorMessage" class="mb-3 text-sm text-rose-600">
        {{ activeRequest.errorMessage }}
      </div>

      <ul class="space-y-2 text-sm">
        <li
          v-for="entry in progressLogs"
          :key="`${entry.timestamp}-${entry.message}`"
          class="flex items-start gap-2"
        >
          <UIcon
            :name="logIcon(entry.type)"
            class="mt-0.5 h-4 w-4 shrink-0"
            :class="logIconClass(entry.type)"
          />
          <span>{{ entry.message }}</span>
        </li>
      </ul>

      <div
        v-if="activeRequest.status === 'completed' && activeRequest.output"
        class="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm"
      >
        <p class="mb-2 font-semibold text-emerald-800">✅ 発行完了</p>
        <dl class="grid gap-1 font-mono text-xs text-emerald-900">
          <div><dt class="inline">Org ID: </dt><dd class="inline">{{ activeRequest.output.organizationId }}</dd></div>
          <div><dt class="inline">Org Code: </dt><dd class="inline">{{ activeRequest.output.organizationCode }}</dd></div>
          <div><dt class="inline">Space ID: </dt><dd class="inline">{{ activeRequest.output.spaceId }}</dd></div>
          <div><dt class="inline">User ID: </dt><dd class="inline">{{ activeRequest.output.userId }}</dd></div>
          <div v-if="activeRequest.output.fileSpaceRequestId">
            <dt class="inline">FileSpace Request: </dt>
            <dd class="inline">{{ activeRequest.output.fileSpaceRequestId }}</dd>
          </div>
        </dl>
      </div>
    </EnCard>

    <EnAlert
      v-if="submitError"
      variant="ai"
      title="エラー"
      :description="submitError"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from "vue";
import { doc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { useFirestore } from "vuefire";
import { ZodError } from "zod";
import {
  getSaasOnboardingCollectionPath,
  saasOnboardingInputSchema,
  saasOnboardingRequestConverter,
  type DecodedSaasOnboardingRequest,
} from "@models/saasOnboardingRequest";
import { suggestOrganizationCode } from "@utils/suggestOrganizationCode";

const { operatorOrganizationCode } = useGodModeAccess();
const organizationStore = useOrganizationStore();
const onboardingStore = useGodModeOnboardingStore();
const db = useFirestore();

const form = reactive({
  email: "",
  password: "",
  organizationName: "",
  organizationCode: "",
  spaceName: "メイン",
  rbacRole: 2 as 2 | 3,
});

const roleOptions = [
  { label: "システム管理者 (組織内全 Space)", value: 2 },
  { label: "利用者 (指定 Space のみ)", value: 3 },
];

const activeRequestId = ref<string | null>(null);
const activeRequest = ref<DecodedSaasOnboardingRequest | null>(null);
const submitError = ref<string | null>(null);
let unsubscribe: Unsubscribe | null = null;

const isBusy = computed(
  () =>
    onboardingStore.isSubmitting ||
    activeRequest.value?.status === "pending" ||
    activeRequest.value?.status === "processing",
);

const isFormValid = computed(() => {
  try {
    saasOnboardingInputSchema.parse(form);
    return true;
  } catch {
    return false;
  }
});

const progressLogs = computed(() => activeRequest.value?.logs ?? []);

const statusLabel = computed(() => {
  const s = activeRequest.value?.status;
  if (s === "pending") return "待機中";
  if (s === "processing") return "実行中";
  if (s === "completed") return "完了";
  if (s === "error") return "失敗";
  return "—";
});

const statusBadgeVariant = computed(() =>
  activeRequest.value?.status === "completed" ? "solid" : "soft",
);

const statusBadgeColor = computed(() => {
  const s = activeRequest.value?.status;
  if (s === "completed") return "success";
  if (s === "error") return "error";
  if (s === "processing") return "warning";
  return "neutral";
});

const maybeSuggestOrgCode = () => {
  if (form.organizationCode.trim()) return;
  form.organizationCode = suggestOrganizationCode(form.organizationName);
};

const stopWatch = () => {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
};

const startWatch = (requestId: string) => {
  stopWatch();
  const orgId = organizationStore.getLoggedInOrganizationId;
  if (!orgId) return;

  const docRef = doc(
    db,
    getSaasOnboardingCollectionPath(orgId),
    requestId,
  ).withConverter(saasOnboardingRequestConverter);

  unsubscribe = onSnapshot(docRef, (snap) => {
    if (snap.exists()) {
      activeRequest.value = snap.data();
    }
  });
};

const onSubmit = async () => {
  submitError.value = null;
  try {
    const created = await onboardingStore.submitOnboardingRequest({ ...form });
    if (created) {
      activeRequestId.value = created.id;
      activeRequest.value = created;
      startWatch(created.id);
    }
  } catch (error) {
    if (error instanceof ZodError) {
      submitError.value = error.errors.map((e) => e.message).join(", ");
    } else {
      submitError.value =
        error instanceof Error ? error.message : "送信に失敗しました";
    }
  }
};

const resetForm = () => {
  stopWatch();
  activeRequestId.value = null;
  activeRequest.value = null;
  submitError.value = null;
  onboardingStore.clearLastRequest();
  form.email = "";
  form.password = "";
  form.organizationName = "";
  form.organizationCode = "";
  form.spaceName = "メイン";
  form.rbacRole = 2;
};

const logIcon = (type: string) => {
  if (type === "error") return "material-symbols:error";
  if (type === "warning") return "material-symbols:warning";
  return "material-symbols:info";
};

const logIconClass = (type: string) => {
  if (type === "error") return "text-rose-500";
  if (type === "warning") return "text-purple-500";
  return "text-sky-500";
};

watch(
  () => organizationStore.getLoggedInOrganizationId,
  () => {
    if (activeRequestId.value) {
      startWatch(activeRequestId.value);
    }
  },
);

onBeforeUnmount(stopWatch);
</script>
