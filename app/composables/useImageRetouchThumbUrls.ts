import { ref, watch, type Ref } from "vue";
import type { ImageRetouchMessageContext } from "@utils/imageStudioState";
import { resolveAdkImageDisplayUrl } from "@utils/adkArtifactUrl";
import {
  resolveArtifactDisplayUrl,
  resolveAuthenticatedUrlFromGcs,
} from "@utils/artifactDisplayUrl";
import { resolveStorageBucketName } from "@utils/adkAttachments";

const parseGsUri = (
  gcsPath: string
): { bucketName: string; filePath: string } | null => {
  const match = gcsPath.match(/^gs:\/\/([^/]+)\/(.+)$/);
  if (!match?.[1] || !match[2]) return null;
  return { bucketName: match[1], filePath: match[2] };
};

export type ImageRetouchThumbUrls = {
  primary: string | null;
  regions: Record<string, string>;
};

/**
 * レタッチ用プレビュー URL — primary は ADK artifact、範囲は crop GCS.
 */
export const useImageRetouchThumbUrls = (params: {
  context: () => ImageRetouchMessageContext | null | undefined;
  sessionId: () => string | null | undefined;
}): { thumbUrls: Ref<ImageRetouchThumbUrls> } => {
  const thumbUrls = ref<ImageRetouchThumbUrls>({ primary: null, regions: {} });

  watch(
    [params.context, params.sessionId],
    async () => {
      const ctx = params.context();
      const sessionId = params.sessionId()?.trim();
      if (!ctx?.primary.adkFilename) {
        thumbUrls.value = { primary: null, regions: {} };
        return;
      }

      const primaryUrl = await resolveAdkImageDisplayUrl({
        sessionId: sessionId ?? undefined,
        artifactId: ctx.primary.artifactId ?? undefined,
        adkFilename: ctx.primary.adkFilename,
        artifactVersion: ctx.primary.artifactVersion ?? undefined,
      });

      const regionUrls: Record<string, string> = {};
      const regionsWithPaths = ctx.regions
        .map((region) => {
          const refPath = region.referenceImage?.gcsPath?.trim();
          const cropPath = region.cropGcsPath?.trim();
          const path = refPath || cropPath;
          return path ? { id: region.id, path } : null;
        })
        .filter((item): item is { id: string; path: string } => item !== null);
      if (regionsWithPaths.length > 0) {
        const { useFirebaseStorageOperations } = await import(
          "@composables/firebase-storage-operations"
        );
        const storageOps = useFirebaseStorageOperations();
        const defaultBucket = resolveStorageBucketName();

        await Promise.all(
          regionsWithPaths.map(async (region) => {
            const path = region.path;
            const parsed = parseGsUri(path);
            const bucketName = parsed?.bucketName ?? defaultBucket;
            const filePath = parsed?.filePath ?? path;
            try {
              const storageUrl = ctx.regions
                .find((r) => r.id === region.id)
                ?.referenceImage?.storageUrl?.trim();
              if (storageUrl) {
                regionUrls[region.id] = storageUrl;
                return;
              }
              const authenticatedUrl = await resolveAuthenticatedUrlFromGcs({
                storageGcsPath: path,
              });
              if (authenticatedUrl) {
                regionUrls[region.id] = authenticatedUrl;
                return;
              }
              const url = await resolveArtifactDisplayUrl({
                storageGcsPath: path,
              });
              if (url) {
                regionUrls[region.id] = url;
                return;
              }
              regionUrls[region.id] = await storageOps.getAuthenticatedUrl({
                bucketName,
                filePath,
              });
            } catch {
              // フォールバック UI
            }
          })
        );
      }

      thumbUrls.value = {
        primary: primaryUrl,
        regions: regionUrls,
      };
    },
    { deep: true, immediate: true }
  );

  return { thumbUrls };
};
