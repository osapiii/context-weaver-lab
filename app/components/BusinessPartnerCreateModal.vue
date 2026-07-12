<template>
  <EnModal
    v-model:open="modalOpen"
    size="full"
    fullscreen
    header-variant="default"
    padding="lg"
    :close-on-backdrop="!isLoading && !isStep1PipelineLoading"
    @close="handleClose"
  >
    <template #title>
      <div class="flex items-center gap-3">
        <EnBadge color="primary" variant="solid" size="sm">
          STEP {{ activatedStepIndex + 1 }}
        </EnBadge>
        <span class="text-base font-bold text-slate-900">
          {{ currentStepTitle }}
        </span>
      </div>
    </template>

    <div class="flex min-h-0 flex-1 flex-col gap-6">
      <div class="px-2">
        <EnStepper
          :model-value="activatedStepIndex"
          :items="stepperItems"
          color="primary"
          size="xl"
          @update:model-value="onStepperNavigate"
        />
      </div>

      <!-- ステップ 1: URL 優先の自動取得 -->
      <EnCard v-if="activatedStepIndex === 0" padding="snug" class="relative">
        <EnAILoadingView
          variant="overlay"
          :active="isStep1PipelineLoading"
          title="AIが登録しています"
          :messages="BUSINESS_PARTNER_LOOKUP_LOADING_MESSAGES"
          :message-index="step1MessageIndex"
          :rotate="step1MessageIndex == null"
        />

        <div
          class="space-y-5"
          :class="{ 'pointer-events-none select-none opacity-40': isStep1PipelineLoading }"
        >
          <EnAlert
            variant="assistant"
            title="会社HPのURLからAIが情報を生成"
            description="公式サイトのURLを入力すると、AIが取引先コードから連絡先まで一括で登録します。確認画面で一覧編集し、不足分はAIアシスタントで補完できます。"
            :icon="businessIcons.client"
          />

          <UFormField label="取引先種別" required>
            <EnRadioGroup
              v-model="form.type"
              value-key="value"
              label-key="label"
              :items="typeItems"
              :columns="2"
            />
          </UFormField>

          <UTabs
            v-model="lookupMode"
            value-key="value"
            :items="lookupModeTabItems"
            :default-value="'url'"
            color="primary"
            variant="link"
            :ui="{ list: 'border-b border-slate-200' }"
          >
            <template #url>
              <div class="space-y-4 pt-4">
                <div
                  class="rounded-xl border border-sky-200/80 bg-gradient-to-br from-sky-50/90 via-white to-violet-50/40 p-5 shadow-sm"
                >
                  <UFormField
                    label="公式サイト URL（会社HP）"
                    required
                    hint="会社HPのURLを入力してAIが情報を生成"
                  >
                    <UInput
                      v-model="lookupForm.url"
                      placeholder="例: https://www.example.co.jp/"
                      size="xl"
                      :disabled="isStep1PipelineLoading"
                      class="w-full"
                      @keydown.enter.prevent="performLookup"
                    />
                  </UFormField>
                </div>
              </div>
            </template>
            <template #corporateNumber>
              <div class="space-y-4 pt-4">
                <UFormField
                  label="法人番号 (13桁)"
                  hint="gBizINFO 等から登記情報を取得します"
                >
                  <UInput
                    v-model="lookupForm.corporateNumber"
                    placeholder="例: 1234567890123"
                    size="lg"
                    :disabled="isStep1PipelineLoading"
                    @keydown.enter.prevent="performLookup"
                  />
                </UFormField>
              </div>
            </template>
          </UTabs>

          <div class="flex flex-wrap gap-3">
            <EnButton
              variant="solid"
              color="primary"
              size="lg"
              :leading-icon="actionIcons.search"
              :loading="isStep1PipelineLoading"
              :disabled="!canTriggerLookup || isStep1PipelineLoading"
              @click="performLookup"
            >
              {{ lookupSubmitLabel }}
            </EnButton>
            <EnButton
              variant="ghost"
              color="neutral"
              size="lg"
              :leading-icon="actionIcons.edit"
              :disabled="isStep1PipelineLoading"
              @click="skipLookup"
            >
              手入力で登録する
            </EnButton>
          </div>

          <EnAlert
            v-if="lookupError"
            color="warning"
            :title="lookupError"
            :icon="actionIcons.warning"
          />
        </div>
      </EnCard>

      <!-- ステップ 2: 確認・編集 (1ページ + 左フォーム / 右 AI) -->
      <div
        v-else-if="activatedStepIndex === 1"
        class="flex min-h-0 flex-1 flex-col gap-4"
      >
        <EnAlert
          v-if="form.lookupSource && form.lookupSource !== 'manual'"
          variant="assistant"
          :title="lookupSourceLabel"
          description="AI が取得した内容を一覧で確認し、必要に応じて編集してから登録してください。不足分は右の AI アシスタントで補完できます。"
          :icon="actionIcons.check"
        />

        <div
          class="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(400px,28rem)] lg:min-h-[min(520px,calc(100vh-16rem))]"
        >
          <div
            class="min-w-0 min-h-0 space-y-4 overflow-y-auto pr-1 max-h-[min(68vh,calc(100vh-14rem))]"
          >
            <EnAlert
              v-if="hasAddressInconsistency"
              color="warning"
              title="所在地の分割を確認してください"
              description="都道府県・市区町村が空のまま、番地欄にフル住所が入っています。都道府県・市区町村・番地に分けて入力してください。"
              :icon="actionIcons.warning"
            />

            <EnCard padding="snug">
              <template #header>
                <h3 class="text-sm font-bold text-slate-800">必須情報</h3>
              </template>
              <div class="space-y-4">
                <UFormField label="取引先種別" required>
                  <EnRadioGroup
                    v-model="form.type"
                    value-key="value"
                    label-key="label"
                    :items="typeItems"
                    :columns="2"
                  />
                </UFormField>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <UFormField
                    label="取引先コード"
                    required
                    :hint="codeFieldHint"
                  >
                    <UInput
                      v-model="form.code"
                      :placeholder="codePlaceholderHint"
                      size="lg"
                    />
                  </UFormField>
                  <UFormField label="法人番号 (13桁)">
                    <UInput
                      v-model="form.corporateNumber"
                      placeholder="例: 1234567890123"
                      size="lg"
                    />
                  </UFormField>
                </div>

                <UFormField label="取引先名 (略称)" required>
                  <UInput
                    v-model="form.name"
                    placeholder="例: 株式会社サンプル"
                    size="lg"
                  />
                </UFormField>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <UFormField label="正式商号">
                    <UInput
                      v-model="form.tradeName"
                      placeholder="例: 株式会社サンプル"
                      size="lg"
                    />
                  </UFormField>
                  <UFormField label="フリガナ">
                    <UInput
                      v-model="form.tradeNameKana"
                      placeholder="例: カブシキガイシャサンプル"
                      size="lg"
                    />
                  </UFormField>
                </div>
              </div>
            </EnCard>

            <EnCard padding="snug">
              <template #header>
                <h3 class="text-sm font-bold text-slate-800">ロゴ画像</h3>
              </template>
              <BusinessPartnerLogoField
                :logo-url="form.logoUrl"
                :image-url="form.imageUrl"
                :favicon-url="form.faviconUrl"
                :name="form.name"
                :auto-fetched-url="autoFetchedBrandUrl"
                :partner-id="draftPartnerId"
                @update:logo-url="form.logoUrl = $event"
                @update:image-url="form.imageUrl = $event"
                @update:favicon-url="form.faviconUrl = $event"
                @pending-file="pendingLogoFile = $event"
              />
            </EnCard>

            <EnCard padding="snug">
              <template #header>
                <h3 class="text-sm font-bold text-slate-800">所在地</h3>
              </template>
              <div class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <UFormField label="郵便番号">
                    <UInput
                      v-model="form.postalCode"
                      placeholder="例: 100-0001"
                      size="lg"
                    />
                  </UFormField>
                  <UFormField label="都道府県">
                    <UInput
                      v-model="form.prefecture"
                      placeholder="例: 東京都"
                      size="lg"
                    />
                  </UFormField>
                  <UFormField label="市区町村">
                    <UInput
                      v-model="form.city"
                      placeholder="例: 千代田区"
                      size="lg"
                    />
                  </UFormField>
                </div>

                <UFormField label="番地・建物等">
                  <UInput
                    v-model="form.streetAddress"
                    placeholder="例: 千代田1-1-1 サンプルビル"
                    size="lg"
                  />
                </UFormField>

                <UFormField label="フル住所 (任意, 上3項目から自動結合)">
                  <UInput
                    v-model="form.address"
                    :placeholder="composedAddress || '上記から自動結合されます'"
                    size="lg"
                  />
                </UFormField>
              </div>
            </EnCard>

            <EnCard padding="snug">
              <template #header>
                <h3 class="text-sm font-bold text-slate-800">会社概要</h3>
              </template>
              <div class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <UFormField label="代表者氏名">
                    <UInput
                      v-model="form.representativeName"
                      placeholder="例: 山田 太郎"
                      size="lg"
                    />
                  </UFormField>
                  <UFormField label="代表者役職">
                    <UInput
                      v-model="form.representativeTitle"
                      placeholder="例: 代表取締役"
                      size="lg"
                    />
                  </UFormField>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <UFormField label="設立日">
                    <UInput
                      v-model="form.foundedDate"
                      type="date"
                      size="lg"
                    />
                  </UFormField>
                  <UFormField label="資本金">
                    <UInput
                      v-model="form.capitalStock"
                      placeholder="例: 10000000 (円)"
                      size="lg"
                    />
                  </UFormField>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <UFormField label="業種">
                    <UInput
                      v-model="form.industry"
                      placeholder="例: SaaS事業"
                      size="lg"
                    />
                  </UFormField>
                  <UFormField label="従業員数">
                    <UInput
                      v-model="form.employeeCount"
                      placeholder="例: 300人"
                      size="lg"
                    />
                  </UFormField>
                </div>

                <UFormField label="事業概要">
                  <UTextarea
                    v-model="form.businessSummary"
                    placeholder="事業内容・取り扱い品目など"
                    :rows="3"
                    size="lg"
                  />
                </UFormField>
              </div>
            </EnCard>

            <EnCard padding="snug">
              <template #header>
                <h3 class="text-sm font-bold text-slate-800">
                  連絡先・担当者（任意）
                </h3>
              </template>
              <div class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <UFormField label="担当者">
                    <UInput
                      v-model="form.contactPerson"
                      placeholder="例: 山田 太郎"
                      size="lg"
                    />
                  </UFormField>
                  <UFormField label="電話番号">
                    <UInput
                      v-model="form.phoneNumber"
                      placeholder="例: 03-1234-5678"
                      size="lg"
                    />
                  </UFormField>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <UFormField label="メールアドレス">
                    <UInput
                      v-model="form.email"
                      placeholder="例: contact@example.com"
                      size="lg"
                    />
                  </UFormField>
                  <UFormField label="ウェブサイト">
                    <UInput
                      v-model="form.website"
                      placeholder="例: https://example.com"
                      size="lg"
                    />
                  </UFormField>
                </div>

                <UFormField label="メモ">
                  <UTextarea
                    v-model="form.note"
                    placeholder="補足事項があれば入力してください"
                    :rows="2"
                    size="lg"
                  />
                </UFormField>
              </div>
            </EnCard>
          </div>

          <BusinessPartnerFormAssistant
            class="hidden lg:flex lg:min-h-0 lg:h-full"
            :snapshot="formSnapshot"
            sub-step="all"
            @apply="onAssistantApply"
          />
        </div>

        <BusinessPartnerFormAssistant
          class="lg:hidden"
          :snapshot="formSnapshot"
          sub-step="all"
          @apply="onAssistantApply"
        />
      </div>

      <!-- ステップ 3: 完了 -->
      <EnCard
        v-else
        padding="snug"
        class="grid h-[200px] place-content-center place-items-center text-center"
      >
        <div class="text-2xl font-bold">
          🎉 新しい取引先の登録が完了しました
        </div>
        <p class="text-sm text-slate-600 mt-2">
          取引先一覧に自動で追加されます。
        </p>
      </EnCard>
    </div>

    <template #footer>
      <EnButton
        variant="ghost"
        color="neutral"
        size="lg"
        :disabled="isLoading || isStep1PipelineLoading"
        @click="handleClose"
      >
        キャンセル
      </EnButton>

      <EnButton
        v-if="activatedStepIndex === 1"
        variant="soft"
        color="neutral"
        size="lg"
        :leading-icon="actionIcons.back"
        :disabled="isLoading"
        @click="goToLookupStep"
      >
        URL入力に戻る
      </EnButton>

      <EnButton
        v-if="activatedStepIndex === 1"
        variant="solid"
        color="primary"
        size="lg"
        :leading-icon="actionIcons.create"
        :loading="isLoading"
        :disabled="!formIsValid"
        @click="createPartner"
      >
        取引先を登録
      </EnButton>

      <EnButton
        v-if="activatedStepIndex === 2"
        variant="solid"
        color="primary"
        size="lg"
        @click="handleClose"
      >
        閉じる
      </EnButton>
    </template>
  </EnModal>
</template>

<script lang="ts" setup>
import { computed, onUnmounted, ref, watch } from "vue";
import type {
  BusinessPartnerLookupResult,
  BusinessPartnerLookupSource,
  BusinessPartnerType,
} from "@models/businessPartner";
import type { BusinessPartnerAssistantPatch } from "@models/businessPartnerFormAssistant";
import { useBusinessPartnerFormAssistant } from "@composables/useBusinessPartnerFormAssistant";
import createRandomDocId from "@utils/createRandomDocId";
import { mergeEmptyFormFields } from "@utils/mergeBusinessPartnerFormFields";
import { suggestBusinessPartnerCode } from "@utils/suggestBusinessPartnerCode";
import { enrichBusinessPartnerLookupAddress } from "@utils/parseJapaneseAddress";
import { resolvePartnerBrandImageUrl } from "@utils/partnerBrandImage";
import EnModal from "@components/EnModal.vue";
import EnAlert from "@components/EnAlert.vue";
import EnBadge from "@components/EnBadge.vue";
import EnButton from "@components/EnButton.vue";
import EnCard from "@components/EnCard.vue";
import EnRadioGroup from "@components/EnRadioGroup.vue";
import EnStepper from "@components/EnStepper.vue";
import EnAILoadingView from "@components/EnAILoadingView.vue";
import BusinessPartnerFormAssistant from "@components/BusinessPartnerFormAssistant.vue";
import BusinessPartnerLogoField from "@components/businessPartner/BusinessPartnerLogoField.vue";
import { useBusinessPartnerLogoUpload } from "@composables/useBusinessPartnerLogoUpload";
import { BUSINESS_PARTNER_LOOKUP_LOADING_MESSAGES } from "~/constants/aiLoadingMessages";

//#region Props / Emits
const modalOpen = defineModel<boolean>("open");

const props = defineProps<{
  /**
   * モーダルを開く際にあらかじめ取引先種別を固定したい場合に指定する。
   * 未指定の場合はユーザがラジオで選択する。
   */
  defaultType?: BusinessPartnerType;
}>();

const emit = defineEmits<{
  close: [];
  created: [partnerId: string];
}>();
//#endregion

//#region Stores / Composables
const businessPartnerStore = useBusinessPartnerStore();
const corporateLookup = useCorporateInfoLookup();
const { uploadLogoFile } = useBusinessPartnerLogoUpload();
const formAssistant = useBusinessPartnerFormAssistant();
const registerAgent = useBusinessPartnerRegisterAgent();
const actionIcons = useActionIcons();
const businessIcons = useBusinessIcons();
const toast = useToast();

//#endregion

//#region State
const activatedStepIndex = ref(0);
const isLoading = ref(false);
const isStep1PipelineLoading = ref(false);
/** null のときメッセージを自動ローテーション。数値指定で固定表示 */
const step1MessageIndex = ref<number | null>(null);
const lookupError = ref<string>("");
/** 登録前にロゴ Storage パス用 ID を確保 */
const draftPartnerId = ref("");
const autoFetchedBrandUrl = ref("");
const pendingLogoFile = ref<File | null>(null);

type LookupMode = "url" | "corporateNumber";

const lookupMode = ref<LookupMode>("url");
const lookupForm = ref<{ corporateNumber: string; url: string }>({
  corporateNumber: "",
  url: "",
});

const lookupModeTabItems = [
  { label: "会社HPのURL", value: "url", slot: "url" as const },
  {
    label: "法人番号で取得",
    value: "corporateNumber",
    slot: "corporateNumber" as const,
  },
];

const stepperItems = computed(() => [
  { title: "URLから自動取得", icon: actionIcons.search },
  { title: "内容の確認・編集", icon: actionIcons.edit },
  { title: "完了", icon: actionIcons.check },
]);

type PartnerFormShape = {
  code: string;
  name: string;
  type: BusinessPartnerType;
  contactPerson: string;
  phoneNumber: string;
  email: string;
  address: string;
  website: string;
  note: string;
  corporateNumber: string;
  tradeName: string;
  tradeNameKana: string;
  postalCode: string;
  prefecture: string;
  city: string;
  streetAddress: string;
  capitalStock: string;
  representativeName: string;
  representativeTitle: string;
  foundedDate: string;
  industry: string;
  employeeCount: string;
  businessSummary: string;
  imageUrl: string;
  logoUrl: string;
  faviconUrl: string;
  lookupSource?: BusinessPartnerLookupSource;
};

const createEmptyForm = (): PartnerFormShape => ({
  code: "",
  name: "",
  type: props.defaultType ?? "supplier",
  contactPerson: "",
  phoneNumber: "",
  email: "",
  address: "",
  website: "",
  note: "",
  corporateNumber: "",
  tradeName: "",
  tradeNameKana: "",
  postalCode: "",
  prefecture: "",
  city: "",
  streetAddress: "",
  capitalStock: "",
  representativeName: "",
  representativeTitle: "",
  foundedDate: "",
  industry: "",
  employeeCount: "",
  businessSummary: "",
  imageUrl: "",
  logoUrl: "",
  faviconUrl: "",
  lookupSource: undefined,
});

const form = ref<PartnerFormShape>(createEmptyForm());

const typeItems = [
  { label: "仕入先", value: "supplier" },
  { label: "顧客", value: "customer" },
];
//#endregion

//#region Computed
const canTriggerLookup = computed(() => {
  if (lookupMode.value === "url") {
    return lookupForm.value.url.trim().length > 0;
  }
  return lookupForm.value.corporateNumber.trim().length > 0;
});

const lookupSubmitLabel = computed(() =>
  lookupMode.value === "url" ? "URLから情報を取得" : "法人番号から情報を取得"
);

const formIsValid = computed(
  () => form.value.code.trim().length > 0 && form.value.name.trim().length > 0
);

const formSnapshot = computed(() => ({
  code: form.value.code,
  name: form.value.name,
  corporateNumber: form.value.corporateNumber,
  tradeName: form.value.tradeName,
  tradeNameKana: form.value.tradeNameKana,
  postalCode: form.value.postalCode,
  prefecture: form.value.prefecture,
  city: form.value.city,
  streetAddress: form.value.streetAddress,
  address: form.value.address,
  capitalStock: form.value.capitalStock,
  representativeName: form.value.representativeName,
  representativeTitle: form.value.representativeTitle,
  foundedDate: form.value.foundedDate,
  industry: form.value.industry,
  employeeCount: form.value.employeeCount,
  businessSummary: form.value.businessSummary,
  contactPerson: form.value.contactPerson,
  phoneNumber: form.value.phoneNumber,
  email: form.value.email,
  website: form.value.website,
  note: form.value.note,
}));

const composedAddress = computed(() =>
  [form.value.prefecture, form.value.city, form.value.streetAddress]
    .filter((s) => s && s.trim().length > 0)
    .join("")
);

const existingPartnerCodes = computed(() =>
  businessPartnerStore.partnerList.map((p) => p.code)
);

const suggestedPartnerCode = computed(() =>
  suggestBusinessPartnerCode({
    type: form.value.type,
    corporateNumber: form.value.corporateNumber,
    name: form.value.name,
    tradeName: form.value.tradeName,
    existingCodes: existingPartnerCodes.value,
  })
);

const hasAddressInconsistency = computed(() => {
  const pref = form.value.prefecture.trim();
  const city = form.value.city.trim();
  const street = form.value.streetAddress.trim();
  if (pref || city || !street) return false;
  return /^(北海道|東京都|(?:京都|大阪)府|.+[都道府県])/.test(street);
});

const codePlaceholderHint = computed(() => {
  if (form.value.code.trim().length > 0) {
    return "例: SUP-001 / DST-001";
  }
  return `例: ${suggestedPartnerCode.value}`;
});

const codeFieldHint = computed(() => {
  if (form.value.code.trim().length > 0) return undefined;
  return `自動生成: ${suggestedPartnerCode.value}`;
});

const lookupSourceLabel = computed(() => {
  switch (form.value.lookupSource) {
    case "corporateNumber":
      return "法人番号から自動取得しました";
    case "url":
      return "公式サイトから自動取得しました";
    default:
      return "";
  }
});

const currentStepTitle = computed(() => {
  switch (activatedStepIndex.value) {
    case 0:
      return "取引先の登録 — 会社HPのURLから取得";
    case 1:
      return "取引先の登録 — 内容の確認・編集";
    case 2:
      return "取引先の登録 — 完了";
    default:
      return "取引先の登録";
  }
});
//#endregion

//#region Methods
const setStep1LoadingMessage = (index: number) => {
  step1MessageIndex.value = Math.min(
    Math.max(index, 0),
    BUSINESS_PARTNER_LOOKUP_LOADING_MESSAGES.length - 1
  );
};

const resetState = () => {
  formAssistant.cancelPending();
  registerAgent.reset();
  activatedStepIndex.value = 0;
  isLoading.value = false;
  isStep1PipelineLoading.value = false;
  step1MessageIndex.value = null;
  lookupError.value = "";
  lookupMode.value = "url";
  lookupForm.value = { corporateNumber: "", url: "" };
  form.value = createEmptyForm();
  draftPartnerId.value = createRandomDocId();
  autoFetchedBrandUrl.value = "";
  pendingLogoFile.value = null;
  if (props.defaultType) {
    form.value.type = props.defaultType;
  }
};

onUnmounted(() => {
  formAssistant.cancelPending();
  registerAgent.reset();
});

const handleClose = () => {
  if (isLoading.value || isStep1PipelineLoading.value) return;
  modalOpen.value = false;
  emit("close");
};

const onStepperNavigate = (index: number) => {
  if (index < activatedStepIndex.value) {
    activatedStepIndex.value = index;
  }
};

/** 確認サブステップは完了済みのみクリックで戻れる */
const goToLookupStep = () => {
  activatedStepIndex.value = 0;
};

const onAssistantApply = (patch: BusinessPartnerAssistantPatch) => {
  if (patch.fields) {
    mergeEmptyFormFields(form.value, patch.fields);
  }
};

/**
 * lookup 結果を form にマージ. 既存入力は保持し、空欄のみ埋める方針.
 */
const mergeLookupResultIntoForm = (result: BusinessPartnerLookupResult) => {
  const enriched = enrichBusinessPartnerLookupAddress(result);

  const setIfEmpty = <K extends keyof PartnerFormShape>(
    key: K,
    value: PartnerFormShape[K] | undefined
  ) => {
    if (value === undefined || value === null) return;
    const current = form.value[key];
    if (typeof current === "string" && current.trim().length > 0) return;
    form.value[key] = value as PartnerFormShape[K];
  };

  setIfEmpty("name", enriched.name);
  setIfEmpty("tradeName", enriched.tradeName ?? enriched.name);
  setIfEmpty("tradeNameKana", enriched.tradeNameKana);
  setIfEmpty("corporateNumber", enriched.corporateNumber);
  setIfEmpty("postalCode", enriched.postalCode);
  setIfEmpty("prefecture", enriched.prefecture);
  setIfEmpty("city", enriched.city);
  setIfEmpty("streetAddress", enriched.streetAddress);
  setIfEmpty("address", enriched.address);
  setIfEmpty("phoneNumber", enriched.phoneNumber);
  setIfEmpty("email", enriched.email);
  setIfEmpty("website", enriched.website);
  setIfEmpty("capitalStock", enriched.capitalStock);
  setIfEmpty("representativeName", enriched.representativeName);
  setIfEmpty("representativeTitle", enriched.representativeTitle);
  setIfEmpty("foundedDate", enriched.foundedDate);
  setIfEmpty("industry", enriched.industry);
  setIfEmpty("employeeCount", enriched.employeeCount);
  setIfEmpty("businessSummary", enriched.businessSummary);
  setIfEmpty("logoUrl", enriched.logoUrl);
  setIfEmpty("faviconUrl", enriched.faviconUrl);
  setIfEmpty(
    "imageUrl",
    enriched.imageUrl ||
      enriched.logoUrl ||
      enriched.faviconUrl
  );

  form.value.lookupSource = enriched.lookupSource;

  refreshAutoFetchedBrandUrl();
};

/** 自動取得したロゴ URL を「自動取得ロゴを使う」用に保持 */
const refreshAutoFetchedBrandUrl = (): void => {
  const url = resolvePartnerBrandImageUrl({
    imageUrl: form.value.imageUrl,
    logoUrl: form.value.logoUrl,
    faviconUrl: form.value.faviconUrl,
  });
  if (url) autoFetchedBrandUrl.value = url;
};

/** 空欄のときだけ取引先コードを自動提案して埋める */
const applySuggestedCodeIfEmpty = () => {
  if (form.value.code.trim().length > 0) return;
  form.value.code = suggestBusinessPartnerCode({
    type: form.value.type,
    corporateNumber: form.value.corporateNumber,
    name: form.value.name,
    tradeName: form.value.tradeName,
    existingCodes: existingPartnerCodes.value,
  });
};

const performLookup = async () => {
  lookupError.value = "";
  const corporateNumber = lookupForm.value.corporateNumber.trim();
  const url = lookupForm.value.url.trim();

  if (lookupMode.value === "url") {
    if (!url) {
      lookupError.value = "会社HPのURLを入力してください。";
      return;
    }
    if (!corporateLookup.isValidUrl(url)) {
      lookupError.value =
        "URL は http:// または https:// で始まる形式で入力してください。";
      return;
    }
  } else if (!corporateNumber) {
    lookupError.value = "法人番号 (13桁) を入力してください。";
    return;
  }

  isStep1PipelineLoading.value = true;
  step1MessageIndex.value = null;

  const input =
    lookupMode.value === "corporateNumber"
      ? { kind: "corporateNumber" as const, value: corporateNumber }
      : { kind: "url" as const, value: url };

  try {
    const outcome = await corporateLookup.lookup(input);

    if (!outcome.ok) {
      lookupError.value = outcome.message;
      return;
    }

    if (lookupMode.value === "corporateNumber") {
      form.value.corporateNumber = corporateLookup.sanitizeCorporateNumber(
        corporateNumber
      );
    }
    if (lookupMode.value === "url" && url && !form.value.website) {
      form.value.website = url;
    }

    mergeLookupResultIntoForm(outcome.result);
    applySuggestedCodeIfEmpty();

    const websiteUrl =
      lookupMode.value === "url"
        ? url
        : form.value.website.trim() || url;

    setStep1LoadingMessage(1);

    let aiPatch = null;
    if (registerAgent.isRequestDocEnabled()) {
      aiPatch = await registerAgent.enrichViaAgent({
        partnerType: form.value.type,
        lookupMode: lookupMode.value,
        websiteUrl,
        corporateNumber: form.value.corporateNumber,
        lookupResult: outcome.result,
        existingCodes: existingPartnerCodes.value,
      });
      if (!aiPatch && registerAgent.lastError.value) {
        lookupError.value = registerAgent.lastError.value;
        return;
      }
    }

    if (!aiPatch) {
      const legacyPatch = await formAssistant.enrichAllFieldsFromUrl({
        snapshot: formSnapshot.value,
        websiteUrl,
      });
      aiPatch = legacyPatch;
    }

    if (aiPatch?.fields) {
      mergeEmptyFormFields(form.value, aiPatch.fields);
      refreshAutoFetchedBrandUrl();
    }
    applySuggestedCodeIfEmpty();

    setStep1LoadingMessage(2);
    await new Promise((resolve) => setTimeout(resolve, 300));

    toast.add({
      title:
        lookupMode.value === "url"
          ? "AI が取引先情報を登録しました"
          : "法人番号から情報を取得しました",
      description:
        aiPatch?.comment ??
        registerAgent.progressMessage.value ??
        "内容を一覧で確認・編集してから登録してください。",
      color: "success",
      icon: actionIcons.check,
    });
    activatedStepIndex.value = 1;
  } finally {
    step1MessageIndex.value = null;
    isStep1PipelineLoading.value = false;
  }
};

const skipLookup = () => {
  if (isStep1PipelineLoading.value) return;
  lookupError.value = "";
  form.value.lookupSource = "manual";
  activatedStepIndex.value = 1;
  applySuggestedCodeIfEmpty();
};

const createPartner = async () => {
  isLoading.value = true;
  const partnerId = draftPartnerId.value || createRandomDocId();
  const trim = (v: string) => (v.trim() ? v.trim() : undefined);

  const finalAddress =
    trim(form.value.address) ?? (composedAddress.value || undefined);

  if (pendingLogoFile.value) {
    const uploaded = await uploadLogoFile({
      partnerId,
      file: pendingLogoFile.value,
    });
    if (uploaded) {
      form.value.logoUrl = uploaded;
      form.value.imageUrl = uploaded;
      form.value.faviconUrl = "";
    }
  }

  const succeeded = await businessPartnerStore.createNewPartner({
    partnerId,
    settings: {
      code: form.value.code.trim(),
      name: form.value.name.trim(),
      type: form.value.type,
      contactPerson: trim(form.value.contactPerson),
      phoneNumber: trim(form.value.phoneNumber),
      email: trim(form.value.email),
      address: finalAddress,
      website: trim(form.value.website),
      note: trim(form.value.note),
      corporateNumber: trim(form.value.corporateNumber),
      tradeName: trim(form.value.tradeName),
      tradeNameKana: trim(form.value.tradeNameKana),
      postalCode: trim(form.value.postalCode),
      prefecture: trim(form.value.prefecture),
      city: trim(form.value.city),
      streetAddress: trim(form.value.streetAddress),
      capitalStock: trim(form.value.capitalStock),
      representativeName: trim(form.value.representativeName),
      representativeTitle: trim(form.value.representativeTitle),
      foundedDate: trim(form.value.foundedDate),
      industry: trim(form.value.industry),
      employeeCount: trim(form.value.employeeCount),
      businessSummary: trim(form.value.businessSummary),
      imageUrl:
        resolvePartnerBrandImageUrl({
          imageUrl: form.value.imageUrl,
          logoUrl: form.value.logoUrl,
          faviconUrl: form.value.faviconUrl,
        }) || trim(form.value.imageUrl),
      logoUrl: trim(form.value.logoUrl),
      faviconUrl: trim(form.value.faviconUrl),
      lookupSource: form.value.lookupSource,
      lookupAt:
        form.value.lookupSource && form.value.lookupSource !== "manual"
          ? new Date().toISOString()
          : undefined,
    },
  });
  isLoading.value = false;

  if (!succeeded) return;

  await businessPartnerStore.fetchPartners();
  toast.add({
    title: "取引先を登録しました",
    color: "success",
    icon: actionIcons.check,
  });
  activatedStepIndex.value = 2;
  emit("created", partnerId);
};

watch(modalOpen, (open) => {
  if (open) resetState();
});

watch(
  () => activatedStepIndex.value,
  (step) => {
    if (step === 1) applySuggestedCodeIfEmpty();
  }
);

watch(
  () => [form.value.type, form.value.corporateNumber, form.value.name, form.value.tradeName] as const,
  () => {
    if (activatedStepIndex.value === 1) applySuggestedCodeIfEmpty();
  }
);
//#endregion
</script>
