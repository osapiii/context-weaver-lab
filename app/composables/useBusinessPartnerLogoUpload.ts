import log from "@utils/logger";

const LOGO_EXT_FROM_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

const extensionFromFile = (file: File): string => {
  const fromMime = LOGO_EXT_FROM_MIME[file.type];
  if (fromMime) return fromMime;
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName;
  return "png";
};

/**
 * 取引先ロゴを Firebase Storage に保存し、一覧表示用の download URL を返す。
 */
export function useBusinessPartnerLogoUpload() {
  const storageOps = useFirebaseStorageOperations();
  const contextStore = useContextStore();
  const toast = useToast();

  const resolveBucketName = (): string | null => {
    const config = useRuntimeConfig();
    const bucket =
      (config.public.firebase as { storageBucket?: string } | undefined)
        ?.storageBucket || "";
    return bucket || null;
  };

  const logoObjectPath = (partnerId: string, ext: string): string =>
    contextStore.baseGcsPath(`businessPartners/${partnerId}/logo.${ext}`);

  const uploadLogoFile = async (params: {
    partnerId: string;
    file: File;
  }): Promise<string | null> => {
    const bucketName = resolveBucketName();
    if (!bucketName) {
      toast.add({
        title: "ストレージ設定が見つかりません",
        color: "error",
      });
      return null;
    }

    const ext = extensionFromFile(params.file);
    const filePath = logoObjectPath(params.partnerId, ext);

    const ok = await storageOps.uploadPdfFile({
      bucketName,
      filePath,
      rawData: params.file,
      mimeType: params.file.type || `image/${ext}`,
    });
    if (!ok) return null;

    try {
      const url = await storageOps.getAuthenticatedUrl({
        bucketName,
        filePath,
      });
      return url ?? null;
    } catch (error) {
      log("ERROR", "uploadLogoFile getAuthenticatedUrl failed", error);
      return null;
    }
  };

  return {
    uploadLogoFile,
    logoObjectPath,
  };
}
