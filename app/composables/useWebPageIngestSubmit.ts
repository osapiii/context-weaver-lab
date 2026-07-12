/**
 * Web ページ取り込みリクエスト作成（Drive Sync と同様にバックグラウンド実行）
 */

import { computed, type Ref } from "vue";
import { useToast, useRuntimeConfig } from "#imports";
import log from "@utils/logger";
import { normalizeWebPageUrl, webPageHostname } from "@utils/webPageUrl";
import { useWebCrawlRequestStore } from "@stores/webCrawlRequest";
import { useOrganizationStore } from "@stores/organization";
import { useSpaceStore } from "@stores/space";
import type { WebCrawlImportFolder } from "@models/webCrawlRequest";

export type WebPageIngestSubmitParams = {
  url: string;
  maxDepth: number;
  maxUrls: number;
  description: string;
  fileSpaceId: string;
  importFolder: WebCrawlImportFolder;
};

export function useWebPageIngestSubmit(fileSpaceId: Ref<string | null>): {
  isSubmitting: Ref<boolean>;
  submit: (params: Omit<WebPageIngestSubmitParams, "fileSpaceId">) => Promise<boolean>;
} {
  const toast = useToast();
  const webCrawlStore = useWebCrawlRequestStore();
  const organizationStore = useOrganizationStore();
  const spaceStore = useSpaceStore();

  const isSubmitting = computed(() => webCrawlStore.isLoading);

  const submit = async (
    params: Omit<WebPageIngestSubmitParams, "fileSpaceId">
  ): Promise<boolean> => {
    const fsId = fileSpaceId.value;
    const normalized = normalizeWebPageUrl(params.url);
    const hostname = webPageHostname(params.url);

    if (!fsId || !normalized || !hostname) {
      toast.add({ title: "URL を入力してください", color: "warning" });
      return false;
    }

    const orgId = organizationStore.getLoggedInOrganizationId;
    const spaceId = spaceStore.selectedSpace?.id;
    if (!orgId || !spaceId) {
      toast.add({ title: "組織/スペース未選択", color: "error" });
      return false;
    }

    try {
      const config = useRuntimeConfig();
      const bucketName =
        config.public.firebase.storageBucket ||
        "en-aistudio-development.firebasestorage.app";
      const folderPath = `organizations/${orgId}/spaces/${spaceId}/fileSpaces/${fsId}/webCrawl/${Date.now()}`;

      const created = await webCrawlStore.createWebCrawlRequest({
        url: normalized,
        bucketName,
        folderPath,
        maxDepth: params.maxDepth,
        maxUrls: params.maxUrls,
        fileSpaceId: fsId,
        includeImages: true,
        description:
          params.description.trim() ||
          `AI 作業スペースから取り込み: ${hostname}`,
        organizationId: orgId,
        spaceId,
        importFolder: params.importFolder,
      });

      if (!created) {
        toast.add({
          title: "取り込みを開始できませんでした",
          description:
            webCrawlStore.createRequestError ??
            "時間を置いて再度お試しください",
          color: "error",
        });
        return false;
      }

      toast.add({
        title: "Web ページの取り込みを開始しました",
        description:
          "バックグラウンドで実行中です。ヘッダーのインジケータからいつでも進捗を確認できます",
        color: "info",
      });
      return true;
    } catch (e) {
      log("ERROR", "useWebPageIngestSubmit failed", e);
      toast.add({
        title: "取り込みを開始できませんでした",
        color: "error",
      });
      return false;
    }
  };

  return { isSubmitting, submit };
}
