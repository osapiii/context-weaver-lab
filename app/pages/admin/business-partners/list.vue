<template>
  <div :class="ADMIN_COLLECTION_PAGE_STACK_CLASS">
    <AdminModePageNav current-page-label="取引先" />

    <BusinessPartnerCreateModal
      v-model:open="isCreateModalOpen"
      :default-type="activeType"
      @close="isCreateModalOpen = false"
    />

    <BusinessPartnerBulkImportModal
      v-model:open="isBulkImportModalOpen"
      @imported="onBulkImported"
      @close="isBulkImportModalOpen = false"
    />

    <header
      class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
    >
      <div class="min-w-0">
        <h1 class="text-3xl font-extrabold tracking-tight text-slate-900">
          取引先
        </h1>
        <p class="mt-1 text-sm text-slate-600">
          仕入先・顧客を登録し、紐づくデータを管理します。
        </p>
      </div>

      <MasterEntryActions
        ref="entryActionsRef"
        entity-label="取引先"
        hide-edit
        :has-ai="false"
        :has-import="true"
        manual-option-title="個別登録"
        manual-option-description="1社ずつ URL や法人番号から登録します"
        import-option-title="一括登録 (CSV)"
        import-option-description="CSV で最大 10 社までまとめて登録します"
        @create-manually="openCreateModal"
        @create-via-import="openBulkImportModal"
      />
    </header>

    <!-- 生産計画 TOP と同様: タイプ切替はグローバルヘッダー直下（カード外） -->
    <UTabs
      v-model="activeType"
      value-key="value"
      :items="tabItems"
      :default-value="activeType"
      variant="pill"
      size="sm"
      :content="false"
      class="w-full min-w-0"
    >
      <template #default="{ item, selected }">
        <div class="flex items-center gap-2 truncate">
          <UIcon :name="item.icon" class="h-4 w-4 shrink-0" />
          <span class="truncate font-semibold">{{ item.label }}</span>
          <EnBadge
            size="sm"
            :color="selected ? 'primary' : 'neutral'"
            variant="soft"
          >
            {{ countByType(item.value as BusinessPartnerType) }}
          </EnBadge>
        </div>
      </template>
    </UTabs>

    <section :class="ADMIN_COLLECTION_PANEL_CLASS">
      <div v-if="isLoading" :class="ADMIN_COLLECTION_GRID_CLASS">
        <USkeleton
          v-for="i in 4"
          :key="i"
          class="h-[280px] w-full rounded-2xl"
        />
      </div>

      <div v-else>
        <div
          v-if="filteredPartners.length === 0"
          class="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center"
        >
          <UIcon
            :name="emptyStateIcon"
            class="mx-auto mb-4 h-14 w-14 text-slate-400"
          />
          <p class="mb-2 text-base font-medium text-slate-700">
            まだ取引先が登録されていません
          </p>
          <p class="mb-6 text-sm text-slate-500">
            「新規登録」から個別登録または CSV 一括登録で追加できます。
          </p>
          <EnButton
            size="lg"
            variant="hero"
            color="primary"
            :leading-icon="actionIcons.add"
            @click="openCreatePicker"
          >
            取引先を登録
          </EnButton>
        </div>

        <div v-else :class="ADMIN_COLLECTION_GRID_CLASS">
          <BusinessPartnerVisualCard
            v-for="partner in filteredPartners"
            :key="partner.id"
            :partner="partner"
            @click="navigateToDetail(partner.id)"
          />
        </div>
      </div>
    </section>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import type { BusinessPartnerType } from "@models/businessPartner";
import MasterEntryActions from "@components/masterEntry/MasterEntryActions.vue";
import BusinessPartnerVisualCard from "@components/businessPartner/BusinessPartnerVisualCard.vue";
import {
  ADMIN_COLLECTION_GRID_CLASS,
  ADMIN_COLLECTION_PAGE_STACK_CLASS,
  ADMIN_COLLECTION_PANEL_CLASS,
} from "@composables/useAdminViewport";

definePageMeta({
  layout: "admin",
  middleware: ["admin-logged-in-check"],
  adminPageStack: false,
});

const router = useRouter();
const route = useRoute();
const organizationStore = useOrganizationStore();
const businessPartnerStore = useBusinessPartnerStore();
const actionIcons = useActionIcons();
const businessIcons = useBusinessIcons();

const isLoading = ref(true);
const isCreateModalOpen = ref(false);
const isBulkImportModalOpen = ref(false);

const entryActionsRef = ref<{
  openCreatePicker: () => void;
} | null>(null);

const openCreatePicker = () => {
  entryActionsRef.value?.openCreatePicker();
};

const tabItems = [
  {
    label: "仕入先",
    value: "supplier" as BusinessPartnerType,
    icon: businessIcons.warehouse,
  },
  {
    label: "顧客",
    value: "customer" as BusinessPartnerType,
    icon: businessIcons.shipping,
  },
];

const initialType = (route.query.type as BusinessPartnerType) || "supplier";
const activeType = ref<BusinessPartnerType>(
  initialType === "customer"
    ? "customer"
    : "supplier"
);

const filteredPartners = computed(() => {
  return businessPartnerStore.partnerList.filter(
    (partner) => partner.type === activeType.value
  );
});

const emptyStateIcon = computed(() =>
  activeType.value === "supplier"
    ? businessIcons.warehouse
    : businessIcons.shipping
);

const countByType = (type: BusinessPartnerType) =>
  businessPartnerStore.partnerList.filter((partner) => partner.type === type)
    .length;

const openCreateModal = () => {
  isCreateModalOpen.value = true;
};

const openBulkImportModal = () => {
  isBulkImportModalOpen.value = true;
};

const onBulkImported = async () => {
  isLoading.value = true;
  await businessPartnerStore.fetchPartners();
  isLoading.value = false;
};

const navigateToDetail = (partnerId: string) => {
  router.push({
    name: "admin-business-partners-detail-id",
    params: { id: partnerId },
    query: { o: organizationStore.loggedInOrganizationInfo.id },
  });
};

onMounted(async () => {
  isLoading.value = true;
  await businessPartnerStore.fetchPartners();
  isLoading.value = false;
});
</script>
