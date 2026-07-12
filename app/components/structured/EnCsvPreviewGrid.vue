<template>
  <div
    class="en-aistudio-csv-preview-grid w-full"
    data-testid="en-aistudio-csv-preview-grid"
  >
    <div
      v-if="loading"
      class="flex h-[280px] items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-sm text-neutral-500"
      role="status"
    >
      <UIcon
        name="material-symbols:progress-activity"
        class="mr-2 h-5 w-5 animate-spin text-emerald-600"
      />
      読み込み中…
    </div>

    <EnAlert
      v-else-if="errorMessage"
      color="error"
      :title="errorMessage"
    />

    <EnAgGrid
      v-else-if="gridModel"
      :row-data="gridModel.rowData"
      :column-defs="gridModel.columnDefs"
      :grid-height-px="gridHeightPx"
      :pagination="pagination"
      :pagination-page-size="paginationPageSize"
      dom-layout="normal"
      wrapper-class="rounded-lg border border-neutral-200 overflow-hidden bg-white"
    />

    <p
      v-else
      class="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-10 text-center text-sm text-neutral-500"
    >
      {{ emptyMessage }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import EnAgGrid from "@components/grid/EnAgGrid.vue";
import EnAlert from "@components/EnAlert.vue";
import { csvTextToAgGridModel } from "@utils/structuredDataPreview";

const props = withDefaults(
  defineProps<{
    text?: string | null;
    loading?: boolean;
    errorMessage?: string | null;
    maxRows?: number;
    gridHeightPx?: number;
    pagination?: boolean;
    paginationPageSize?: number;
    emptyMessage?: string;
  }>(),
  {
    text: null,
    loading: false,
    errorMessage: null,
    maxRows: 500,
    gridHeightPx: 420,
    pagination: true,
    paginationPageSize: 25,
    emptyMessage: "表示する CSV データがありません",
  }
);

const gridModel = computed(() => {
  if (props.loading || props.errorMessage || !props.text?.trim()) {
    return null;
  }
  return csvTextToAgGridModel({
    text: props.text,
    maxRows: props.maxRows,
  });
});
</script>
