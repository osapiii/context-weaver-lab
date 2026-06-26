<template>
  <UApp :toaster="toastConfig">
    <NuxtErrorBoundary>
      <div v-if="globalErrorStore.globalErrorModalStatus == 'triggered'">
        <EPopUpModal v-model:modal-is-open="globalErrorStore.isModalOpen">
          <template #main-content>
            <UContainer>
              <div class="text-center">
                <Icon
                  size="60"
                  name="i-heroicons-x-circle-16-solid"
                  color="red"
                />
              </div>
              <div class="mb-2 text-xs font-bold mt-2">
                <p>
                  エラーが発生しました。お手数ですが、担当者までご連絡ください。
                </p>
              </div>
              <EnAlert
                class="mt-3 mb-3"
                color="error"
                variant="outline"
                :title="globalErrorStore.selectedErrorMessage.message"
              />
            </UContainer>
          </template>
          <template #left-button>
            <EButton
              color="background"
              variant="outline"
              label="閉じる"
              @click="globalErrorStore.globalErrorModalStatus = 'none'"
            />
          </template>
          <template #right-button>
            <EButton
              label="問い合わせ"
              @click="globalErrorStore.globalErrorModalStatus = 'none'"
            />
          </template>
        </EPopUpModal>
      </div>
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
      <!-- EN AIstudio assistant FAB is mounted by layout/admin.vue,
           ここではマウントしない. -->
    </NuxtErrorBoundary>
  </UApp>
</template>

<script lang="ts" setup>
import type { ToasterProps } from "@nuxt/ui";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
} from "@constants/siteSeo";

//#region store
const globalErrorStore = useGlobalErrorStore();
// For Nuxt 3
definePageMeta({
  colorMode: "light",
});

useHead({
  titleTemplate: (titleChunk) =>
    titleChunk && titleChunk !== SITE_NAME
      ? `${titleChunk} | ${SITE_NAME}`
      : SITE_NAME,
});

useSeoMeta({
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  ogSiteName: SITE_NAME,
  ogTitle: SITE_NAME,
  ogDescription: SITE_DESCRIPTION,
  ogType: "website",
  ogUrl: SITE_URL,
  twitterCard: "summary",
  twitterTitle: SITE_NAME,
  twitterDescription: SITE_DESCRIPTION,
});
//#endregion store

//#region ui-config
const toastConfig: ToasterProps = {
  position: "top-right",
  portal: true,
};
//#endregion ui-config
</script>
