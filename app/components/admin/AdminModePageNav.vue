<template>
  <nav
    v-if="showBackButton || breadcrumbLinks.length > 0"
    class="mb-6 space-y-2"
    aria-label="ページ階層"
  >
    <div
      v-if="showBackButton"
      class="flex min-w-0 items-center gap-2 text-xs"
    >
      <UButton
        :icon="actionIcons.back ?? 'i-heroicons-arrow-left'"
        color="neutral"
        variant="ghost"
        size="xs"
        @click="goBack"
      >
        {{ backTargetLabel }}に戻る
      </UButton>
      <span class="text-slate-400" aria-hidden="true">/</span>
      <span class="truncate font-semibold text-slate-600">
        {{ currentPageLabel }}
      </span>
    </div>

    <EBreadCrumb
      v-if="breadcrumbLinks.length > 0"
      :links="breadcrumbLinks"
    />
  </nav>
</template>

<script setup lang="ts">
import type { UseAdminPageNavigationOptions } from "@composables/useAdminPageNavigation";
import EBreadCrumb from "@components/EBreadCrumb.vue";

const props = defineProps<UseAdminPageNavigationOptions>();

const actionIcons = useActionIcons();

const {
  currentPageLabel,
  backTargetLabel,
  breadcrumbLinks,
  showBackButton,
  goBack,
} = useAdminPageNavigation({
  currentPageLabel: () => props.currentPageLabel,
  trail: () => props.trail,
  hideBackButton: props.hideBackButton,
});
</script>
