import { z } from "zod";
import { firestoreTypeConverter } from "./firestoreTypeConverter";
import { Timestamp } from "firebase/firestore";

/**
 * 組織のブランディング設定。
 * 未設定なら EN AIstudio デフォルト ("EN AIstudio" ロゴテキスト + 標準 AI アバター) が使われる。
 */
export const organizationBrandingSchema = z.object({
  /** ヘッダーに表示するロゴ画像 URL。設定されると "EN AIstudio" 文字は消える */
  logoUrl: z.string().optional(),
  /** AI アシスタントのアバター画像 URL。設定されると標準 AI アバターの代わりに表示される */
  aiAvatarUrl: z.string().optional(),
  /** Nuxt UI のカラーテーマプリセット ID (composables/useColorTheme.ts) */
  colorThemeId: z.string().optional(),
});
export type OrganizationBranding = z.infer<typeof organizationBrandingSchema>;

// スキーマを定義
export const organizationSchema = z.object({
  name: z.string(),
  code: z.string(),
  branding: organizationBrandingSchema.optional(),
});

// id, createdAt, updatedAtの3つのフィールドを追加した新しいスキーマを定義
export const decodedOrganizationSchema = organizationSchema.extend({
  id: z.string(),
  createdAt: z.instanceof(Timestamp),
  updatedAt: z.instanceof(Timestamp),
});

// スキーマをもとに型を作成
export type decodedOrganizationSchema = z.infer<
  typeof decodedOrganizationSchema
>;

// FirestoreのTypeConverterを作成
export const organizationConverter = firestoreTypeConverter(
  decodedOrganizationSchema
);
