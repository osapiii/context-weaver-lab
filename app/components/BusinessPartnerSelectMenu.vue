<template>
  <div class="w-full">
    <div class="flex items-stretch gap-2">
      <USelectMenu
        :model-value="modelValue as any"
        :items="(items as any)"
        value-key="id"
        label-key="label"
        :placeholder="placeholder"
        :size="size"
        :disabled="disabled"
        :ui="{
          trailingIcon:
            'group-data-[state=open]:rotate-180 transition-transform duration-200',
        }"
        class="w-full"
        @update:model-value="onSelectionChange"
      >
        <template #item-label="{ item }">
          <div class="flex items-center gap-2 min-w-0">
            <UIcon
              :name="partnerTypeIcon"
              class="size-4 text-purple-600 shrink-0"
            />
            <span class="truncate">{{ item.label }}</span>
            <span class="text-xs text-gray-400 font-mono shrink-0 ml-auto">
              {{ item.code }}
            </span>
          </div>
        </template>
      </USelectMenu>

      <UButton
        v-if="!disableInlineCreate"
        :icon="actionIcons.add"
        color="primary"
        variant="outline"
        :size="size"
        :disabled="disabled"
        @click="openCreateModal"
      >
        新規
      </UButton>
    </div>

    <p
      v-if="required && !modelValue && showRequiredHint"
      class="mt-1.5 text-xs text-red-500 font-medium"
    >
      取引先の選択は必須です。一覧から選ぶか「新規」で登録してください。
    </p>

    <BusinessPartnerCreateModal
      v-if="!disableInlineCreate"
      v-model:open="isCreateModalOpen"
      :default-type="partnerType"
      @created="handleCreated"
    />
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import type { BusinessPartnerType } from "@models/businessPartner";
import BusinessPartnerCreateModal from "@components/BusinessPartnerCreateModal.vue";

/**
 * 取引先を選択する共通セレクトメニュー.
 *
 * - `partnerType` で仕入先 / 顧客 をフィルタ
 * - インライン「+ 新規」ボタンで `BusinessPartnerCreateModal` を起動し、
 *   登録後はその場で選択状態にする
 * - `required` 指定時は未選択ハイントを赤字で表示 (バリデーションは呼び出し側で行う)
 *
 * 利用例:
 *   <BusinessPartnerSelectMenu
 *     v-model="form.businessPartnerId"
 *     partner-type="customer"
 *     required
 *   />
 */
const modelValue = defineModel<string | undefined>();

const props = withDefaults(
  defineProps<{
    /** 表示・新規作成時の取引先種別を固定 */
    partnerType: BusinessPartnerType;
    placeholder?: string;
    size?: "xs" | "sm" | "md" | "lg" | "xl";
    required?: boolean;
    disabled?: boolean;
    /** UI 上に「未選択は必須エラー」を表示する (form submit 時にトグル) */
    showRequiredHint?: boolean;
    /** 新規登録ボタンを隠す (読み取り用途) */
    disableInlineCreate?: boolean;
  }>(),
  {
    placeholder: "取引先を選択",
    size: "md",
    required: false,
    disabled: false,
    showRequiredHint: false,
    disableInlineCreate: false,
  }
);

const businessPartnerStore = useBusinessPartnerStore();
const actionIcons = useActionIcons();
const businessIcons = useBusinessIcons();

const isCreateModalOpen = ref(false);

const filteredPartners = computed(() =>
  businessPartnerStore.partnerList.filter(
    (partner) => partner.type === props.partnerType
  )
);

type PartnerItem = { id: string; label: string; code: string };

const items = computed<PartnerItem[]>(() =>
  filteredPartners.value.map((partner) => ({
    id: partner.id,
    label: partner.name,
    code: partner.code,
  }))
);

const partnerTypeIcon = computed(() =>
  props.partnerType === "supplier"
    ? businessIcons.warehouse
    : businessIcons.shipping
);

const onSelectionChange = (v: unknown) => {
  modelValue.value = typeof v === "string" && v.length > 0 ? v : undefined;
};

const openCreateModal = () => {
  isCreateModalOpen.value = true;
};

const handleCreated = async (partnerId: string) => {
  // モーダルが完了画面を表示後、partnerList は既に fetch 済み。即座に選択状態にする。
  modelValue.value = partnerId;
};

onMounted(async () => {
  // 取引先がまだ取得されていない場合に取得
  if (businessPartnerStore.partnerList.length === 0) {
    await businessPartnerStore.fetchPartners();
  }
});
</script>
