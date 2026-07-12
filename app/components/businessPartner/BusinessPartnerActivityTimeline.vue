<template>
  <div class="space-y-6">
    <div
      v-if="items.length === 0"
      class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center"
    >
      <UIcon
        :name="businessIcons.inventory"
        class="mx-auto mb-3 h-10 w-10 text-slate-400"
      />
      <p class="text-sm font-medium text-gray-700">まだ取引ログがありません</p>
      <p class="mt-1 text-xs text-gray-500">
        取引実績の登録が始まると、ここに時系列で表示されます。
      </p>
    </div>

    <ol v-else class="relative border-l-2 border-slate-200 pl-8">
      <li
        v-for="item in items"
        :key="item.id"
        class="relative pb-8 last:pb-0"
      >
        <span
          class="absolute -left-[2.125rem] flex h-8 w-8 items-center justify-center rounded-full border-2 border-white shadow-sm"
          :class="kindDotClass(item.kind)"
        >
          <UIcon :name="kindIcon(item.kind)" class="h-4 w-4 text-white" />
        </span>
        <div
          class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-purple-200"
        >
          <div class="flex flex-wrap items-center gap-2">
            <EnBadge :color="kindBadgeColor(item.kind)" variant="soft" size="sm">
              {{ kindLabel(item.kind) }}
            </EnBadge>
            <time class="text-xs font-medium text-gray-500">
              {{ item.dateLabel }}
            </time>
          </div>
          <h4 class="mt-2 text-sm font-bold text-gray-900">
            {{ item.title }}
          </h4>
          <p v-if="item.subtitle" class="mt-1 text-sm text-gray-600">
            {{ item.subtitle }}
          </p>
          <p
            v-if="item.meta"
            class="mt-2 font-mono text-xs text-gray-500"
          >
            {{ item.meta }}
          </p>
        </div>
      </li>
    </ol>
  </div>
</template>

<script lang="ts" setup>
import type { DecodedMaterialPurchaseRecord } from "@models/materialPurchaseRecord";
import EnBadge from "@components/EnBadge.vue";

export type PartnerActivityKind = "purchase" | "shipping" | "note";

export interface PartnerActivityItem {
  id: string;
  kind: PartnerActivityKind;
  dateLabel: string;
  sortKey: string;
  title: string;
  subtitle?: string;
  meta?: string;
}

const props = defineProps<{
  purchaseRecords: DecodedMaterialPurchaseRecord[];
}>();

const businessIcons = useBusinessIcons();

const formatAmount = (raw: string | number | undefined): string | undefined => {
  if (raw == null || raw === "") return undefined;
  const n = Number(raw);
  if (Number.isFinite(n)) {
    return `${n.toLocaleString("ja-JP")} 円`;
  }
  return String(raw);
};

const purchaseToActivity = (
  r: DecodedMaterialPurchaseRecord
): PartnerActivityItem => {
  const qty = r.quantity != null ? String(r.quantity) : "";
  const unit = r.unit ? ` ${r.unit}` : "";
  const amount = formatAmount(r.totalAmount);
  const metaParts = [
    amount,
    r.lotNumber ? `ロット: ${r.lotNumber}` : undefined,
  ].filter(Boolean);

  return {
    id: r.id,
    kind: "purchase",
    dateLabel: r.purchaseDate || "日付未設定",
    sortKey: r.purchaseDate || "",
    title: r.materialName || r.materialCode || "仕入",
    subtitle: [
      r.materialCode ? `コード: ${r.materialCode}` : undefined,
      qty ? `数量: ${qty}${unit}` : undefined,
      r.unitPrice != null ? `単価: ${formatAmount(r.unitPrice)}` : undefined,
    ]
      .filter(Boolean)
      .join(" · "),
    meta: metaParts.length > 0 ? metaParts.join(" · ") : undefined,
  };
};

const items = computed(() => {
  const list = props.purchaseRecords.map(purchaseToActivity);
  return list.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
});

const kindLabel = (kind: PartnerActivityKind) => {
  switch (kind) {
    case "purchase":
      return "仕入";
    case "shipping":
      return "納品";
    default:
      return "メモ";
  }
};

const kindIcon = (kind: PartnerActivityKind) => {
  switch (kind) {
    case "purchase":
      return businessIcons.inventory;
    case "shipping":
      return businessIcons.shipping;
    default:
      return businessIcons.client;
  }
};

const kindBadgeColor = (kind: PartnerActivityKind) => {
  switch (kind) {
    case "purchase":
      return "primary" as const;
    case "shipping":
      return "info" as const;
    default:
      return "neutral" as const;
  }
};

const kindDotClass = (kind: PartnerActivityKind) => {
  switch (kind) {
    case "purchase":
      return "bg-purple-600";
    case "shipping":
      return "bg-sky-600";
    default:
      return "bg-slate-500";
  }
};
</script>
