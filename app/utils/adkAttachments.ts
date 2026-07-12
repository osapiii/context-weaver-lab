import type { AttachedFile } from "@adapters/masterEditor/types";
import log from "@utils/logger";

/** ADK InvokeRequest.attachments の 1 件 (snake_case JSON) */
export interface AdkAttachmentPayload {
  id: string;
  name: string;
  url: string;
  mime_type: string;
  size: number;
}

const parseGsUri = (
  gcsPath: string
): { bucketName: string; filePath: string } | null => {
  const match = gcsPath.match(/^gs:\/\/([^/]+)\/(.+)$/);
  if (!match?.[1] || !match[2]) return null;
  return { bucketName: match[1], filePath: match[2] };
};

export const resolveStorageBucketName = (
  configuredBucket?: string | null
): string =>
  configuredBucket ||
  process.env.NUXT_PUBLIC_FIREBASECONFIG_STORAGEBUCKET ||
  "en-aistudio-development.firebasestorage.app";

const attachmentIdFrom = (attachment: AttachedFile, index: number): string => {
  const base = attachment.gcsPath || attachment.fileName;
  const sanitized = base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return sanitized || `attachment-${index}`;
};

/**
 * AttachedFile (gcsPath / fileName) を ADK AttachmentRef 形式に変換する.
 * BE は url を fetch して multimodal Part に変換する.
 */
export async function resolveAdkAttachments(
  attachments: AttachedFile[],
  options?: { defaultBucketName?: string }
): Promise<AdkAttachmentPayload[]> {
  if (attachments.length === 0) return [];

  const { useFirebaseStorageOperations } = await import(
    "@composables/firebase-storage-operations"
  );
  const storageOps = useFirebaseStorageOperations();
  const defaultBucket = resolveStorageBucketName(options?.defaultBucketName);

  const resolved: AdkAttachmentPayload[] = [];

  for (let index = 0; index < attachments.length; index += 1) {
    const attachment = attachments[index]!;
    if (attachment.localFile) {
      throw new Error(
        `添付ファイル「${attachment.fileName}」が未アップロードです。送信前にもう一度お試しください。`
      );
    }

    const parsed = parseGsUri(attachment.gcsPath);
    const bucketName = parsed?.bucketName ?? defaultBucket;
    const filePath = parsed?.filePath ?? attachment.gcsPath;

    if (!filePath) {
      log("WARN", "[resolveAdkAttachments] skip attachment without path", {
        fileName: attachment.fileName,
      });
      continue;
    }

    try {
      const url = await storageOps.getAuthenticatedUrl({
        bucketName,
        filePath,
      });
      resolved.push({
        id: attachmentIdFrom(attachment, index),
        name: attachment.fileName,
        url,
        mime_type: attachment.mimeType || "application/octet-stream",
        size: 0,
      });
    } catch (error) {
      log("ERROR", "[resolveAdkAttachments] failed to resolve URL", {
        fileName: attachment.fileName,
        bucketName,
        filePath,
        error,
      });
      throw new Error(
        `添付ファイル「${attachment.fileName}」の URL 取得に失敗しました`
      );
    }
  }

  return resolved;
}
