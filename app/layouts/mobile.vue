<template>
  <div class="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
    <EFullScreenLoading
      :active="globalLoading.isLoading"
      :message="globalLoading.loadingText"
    />

    <header
      class="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200"
    >
      <div class="flex items-center justify-between px-4 h-12">
        <NuxtLink
          :to="{ name: 'admin-vibe-control' }"
          class="inline-flex items-center"
          aria-label="StoryVault ホームへ"
        >
          <img
            src="/storyvault-logo.svg"
            alt="StoryVault"
            class="h-7 w-[144px] object-contain"
          >
        </NuxtLink>

        <UDropdownMenu
          :items="menuItems"
          :content="{ align: 'end' }"
        >
          <button
            type="button"
            class="flex items-center gap-2 px-2 h-8 rounded-full hover:bg-slate-100 active:bg-slate-200 transition-colors"
            aria-label="メニュー"
          >
            <UAvatar
              :alt="organization.loggedInOrganizationInfo.name || 'user'"
              size="2xs"
              class="bg-slate-700 text-white"
            />
            <UIcon name="i-heroicons-chevron-down" class="w-4 h-4 text-slate-500" />
          </button>
        </UDropdownMenu>
      </div>
    </header>

    <main class="pb-8">
      <slot />
    </main>

  </div>
</template>

<script lang="ts" setup>
defineOptions({
  name: "MobileLayout",
});

const actionIcons = useActionIcons();
const auth = useAdminUserStore();
const organization = useOrganizationStore();
const globalLoading = useGlobalLoadingStore();

const menuItems = computed(() => [
  {
    label: "サインアウト",
    icon: actionIcons.logout,
    onSelect: () => auth.signOut(),
  },
]);
</script>
