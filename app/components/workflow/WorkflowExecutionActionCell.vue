<template>
  <div class="flex h-full items-center gap-1" @click.stop>
    <EnButton
      v-if="canOpenResult"
      size="xs"
      variant="soft"
      color="primary"
      @click="openResult"
    >
      結果
    </EnButton>
    <EnButton
      size="xs"
      variant="ghost"
      color="neutral"
      @click="openDetail"
    >
      詳細
    </EnButton>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ICellRendererParams } from "ag-grid-community";
import type { WorkflowExecutionGridRow } from "@components/WorkflowExecutionAgGrid.vue";

const props = defineProps<{
  params: ICellRendererParams<WorkflowExecutionGridRow> & {
    context?: {
      onOpenResult?: (rowId: string) => void;
      onOpenDetail?: (rowId: string) => void;
    };
  };
}>();

const canOpenResult = computed(
  () => props.params.data?.status === "completed" && props.params.data.navigable
);

const openResult = (): void => {
  if (!props.params.data || !canOpenResult.value) return;
  props.params.context?.onOpenResult?.(props.params.data.id);
};

const openDetail = (): void => {
  if (!props.params.data) return;
  props.params.context?.onOpenDetail?.(props.params.data.id);
};
</script>
