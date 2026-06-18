import { z } from "zod";
import { Timestamp } from "firebase/firestore";
import { firestoreTypeConverter } from "./firestoreTypeConverter";

/**
 * GoogleDriveIntegrationConfig (Phase R-1b)
 *
 * 1 organization に 1 つ。ユーザーが共有した Drive ルートフォルダの ID と、
 * Drive ↔ default FileSpace 同期の最終ステータスを保持する。
 *
 * 格納パス: organizations/{orgId}/externalServiceConfigs/googleDriveIntegration/{configId}
 *   (configId は通常 "default" 固定で 1 件のみ)
 */
export const googleDriveIntegrationConfigSchema = z.object({
  // ユーザーが Service Account に共有した Drive フォルダの ID
  rootFolderId: z.string(),
  // 表示用の (作成時に Drive API から取得した) フォルダ名
  rootFolderName: z.string().nullable().optional(),
  // 表示用 + コピー対象の SA メールアドレス
  serviceAccountEmail: z.string(),
  // 同期先 FileSpace の Gemini storeId (= default FileSpace)
  linkedFileSpaceId: z.string().nullable().optional(),
  // 最後にオンデマンド同期した時刻 (UI 表示用)
  lastSyncedAt: z.instanceof(Timestamp).nullable().optional(),
  lastSyncStatus: z.enum(["ok", "error"]).nullable().optional(),
  lastSyncError: z.string().nullable().optional(),
});

export const decodedGoogleDriveIntegrationConfigSchema =
  googleDriveIntegrationConfigSchema.extend({
    id: z.string(),
    createdAt: z.instanceof(Timestamp),
    updatedAt: z.instanceof(Timestamp),
  });

export type DecodedGoogleDriveIntegrationConfig = z.infer<
  typeof decodedGoogleDriveIntegrationConfigSchema
>;

export const googleDriveIntegrationConfigConverter = firestoreTypeConverter(
  decodedGoogleDriveIntegrationConfigSchema
);

// configId は organization 内で 1 つに固定する
export const DEFAULT_DRIVE_CONFIG_ID = "default";
