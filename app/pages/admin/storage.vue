<template>
  <div class="flex min-h-0 flex-1 flex-col space-y-6">
    <AdminModePageNav current-page-label="ストレージ" />

    <EnAiPageHeader
      title="ストレージエクスプローラー"
      subtitle="Firebase Storage 上の organizations 配下をブラウズできます"
      :icon="fileIcons.folderOpen"
    >
      <template #trailing>
        <EnButton
          v-if="spacePrefix"
          variant="outline"
          size="sm"
          @click="navigateToSpaceRoot"
        >
          選択中 Space へ
        </EnButton>
        <EnButton variant="soft" size="sm" @click="navigateToOrgRoot">
          組織ルートへ
        </EnButton>
      </template>
    </EnAiPageHeader>

    <div class="min-h-0 flex-1">
      <AdminStorageExplorer />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import AdminStorageExplorer from "@components/admin/storage/AdminStorageExplorer.vue";
import EnAiPageHeader from "@components/ai/EnAiPageHeader.vue";
import { useFileStorageViewerStore } from "@stores/fileStorageViewer";

definePageMeta({
  layout: "admin",
  middleware: ["admin-logged-in-check"],
  adminPageStack: false,
  adminPageFillHeight: true,
});

const fileIcons = useFileIcons();
const router = useRouter();
const store = useFileStorageViewerStore();
const organizationStore = useOrganizationStore();
const spaceStore = useSpaceStore();

const organizationId = computed(
  () => organizationStore.getLoggedInOrganizationId ?? ""
);

const bucketName = computed(() => {
  const config = useRuntimeConfig();
  return (
    config.public.firebase?.storageBucket ||
    "en-aistudio-development.firebasestorage.app"
  );
});

const orgRootPrefix = computed(() =>
  organizationId.value ? `organizations/${organizationId.value}/` : ""
);

const spacePrefix = computed(() => {
  const spaceId = spaceStore.selectedSpace?.id;
  if (!organizationId.value || !spaceId) return null;
  return `organizations/${organizationId.value}/spaces/${spaceId}/`;
});

const navigateToOrgRoot = async (): Promise<void> => {
  if (!orgRootPrefix.value) return;
  await router.replace({
    name: "admin-storage",
    query: { gcsPrefix: orgRootPrefix.value },
  });
  await store.navigateToPath(orgRootPrefix.value, bucketName.value);
};

const navigateToSpaceRoot = async (): Promise<void> => {
  if (!spacePrefix.value) return;
  await router.replace({
    name: "admin-storage",
    query: { gcsPrefix: spacePrefix.value },
  });
  await store.navigateToPath(spacePrefix.value, bucketName.value);
};
</script>
