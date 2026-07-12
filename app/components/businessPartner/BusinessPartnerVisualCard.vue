<template>
  <EGameLikeCard
    :title="partner.name"
    :description="partner.tradeName || partner.businessSummary || ''"
    :image-url="displayImageUrl"
    :placeholder-icon="typeIcon"
    :menu-item-is-active="false"
    @click="emit('click')"
  >
    <template #title>
      <span class="line-clamp-2">{{ partner.name }}</span>
    </template>
    <template #body>
      <div class="space-y-1">
        <div class="font-mono text-[10px] text-slate-500">
          {{ partner.code }}
        </div>
        <div
          v-if="partner.contactPerson || partner.phoneNumber"
          class="line-clamp-2 text-[10px] text-slate-500"
        >
          <span v-if="partner.contactPerson">担当: {{ partner.contactPerson }}</span>
          <span v-if="partner.phoneNumber" class="ml-1">
            {{ partner.contactPerson ? "·" : "" }} {{ partner.phoneNumber }}
          </span>
        </div>
        <div class="text-[10px] text-slate-400">
          作成: {{ formatTimestamp(partner.createdAt.toDate()) }}
        </div>
      </div>
    </template>
  </EGameLikeCard>
</template>

<script setup lang="ts">
import type { DecodedBusinessPartner } from "@models/businessPartner";
import { formatTimestamp } from "@utils/date";
import { resolvePartnerBrandImageUrl } from "@utils/partnerBrandImage";

const props = defineProps<{
  partner: DecodedBusinessPartner;
}>();

const emit = defineEmits<{
  click: [];
}>();

const businessIcons = useBusinessIcons();

const typeIcon = computed(() =>
  props.partner.type === "supplier"
    ? businessIcons.warehouse
    : businessIcons.shipping
);

const displayImageUrl = computed(
  () => resolvePartnerBrandImageUrl(props.partner) || ""
);
</script>
