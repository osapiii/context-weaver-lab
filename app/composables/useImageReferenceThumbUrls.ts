import { ref, watch, type Ref } from "vue";
import type { ImageReference } from "@utils/imageReference";
import { resolveStorageBucketName } from "@utils/adkAttachments";

const parseGsUri = (
  gcsPath: string
): { bucketName: string; filePath: string } | null => {
  const match = gcsPath.match(/^gs:\/\/([^/]+)\/(.+)$/);
  if (!match?.[1] || !match[2]) return null;
  return { bucketName: match[1], filePath: match[2] };
};

/**
 * お手本画像のプレビュー URL（storageUrl または gcsPath から認証付き URL）を解決する.
 */
export const useImageReferenceThumbUrls = (params: {
  references: () => ImageReference[];
}): { thumbUrls: Ref<Record<string, string>> } => {
  const thumbUrls = ref<Record<string, string>>({});

  watch(
    params.references,
    async (refs) => {
      const next: Record<string, string> = {};
      if (refs.length === 0) {
        thumbUrls.value = next;
        return;
      }

      const { useFirebaseStorageOperations } = await import(
        "@composables/firebase-storage-operations"
      );
      const storageOps = useFirebaseStorageOperations();
      const defaultBucket = resolveStorageBucketName();

      await Promise.all(
        refs.map(async (ref) => {
          if (ref.storageUrl) {
            next[ref.id] = ref.storageUrl;
            return;
          }
          if (!ref.gcsPath) return;

          const parsed = parseGsUri(ref.gcsPath);
          const bucketName = parsed?.bucketName ?? defaultBucket;
          const filePath = parsed?.filePath ?? ref.gcsPath;

          try {
            next[ref.id] = await storageOps.getAuthenticatedUrl({
              bucketName,
              filePath,
            });
          } catch {
            // プレビュー失敗時はフォールバック UI を表示
          }
        })
      );

      thumbUrls.value = next;
    },
    { deep: true, immediate: true }
  );

  return { thumbUrls };
};
