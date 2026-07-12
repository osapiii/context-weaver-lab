import { Timestamp } from "firebase/firestore";
import { z } from "zod";
import { firestoreTypeConverter } from "./firestoreTypeConverter";
import { RequestMetadataSchema } from "./core/operationMetadata";
import { RequestLogSchema, RequestStatusEnum } from "./core/requestStatus";

/** SaaS 新規アカウント発行 (Godモード) の入力 */
export const saasOnboardingInputSchema = z.object({
  /** 新規ユーザーのメールアドレス */
  email: z.string().email(),
  /** 初期パスワード (Firebase Auth 要件: 6文字以上) */
  password: z.string().min(6),
  /** 組織名 */
  organizationName: z.string().min(1).max(100),
  /** 組織コード (英数字・一意) */
  organizationCode: z
    .string()
    .min(2)
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/, "英数字・ハイフン・アンダースコアのみ"),
  /** 初期 Space 名 */
  spaceName: z.string().min(1).max(50).default("メイン"),
  /** 付与する RBAC ロール (2=システム管理者, 3=利用者) */
  rbacRole: z.union([z.literal(2), z.literal(3)]).default(2),
});

export type SaasOnboardingInput = z.infer<typeof saasOnboardingInputSchema>;

/** オンボーディング完了時の出力 */
export const saasOnboardingOutputSchema = z.object({
  organizationId: z.string(),
  organizationCode: z.string(),
  spaceId: z.string(),
  userId: z.string(),
  fileSpaceRequestId: z.string().optional(),
});

export type SaasOnboardingOutput = z.infer<typeof saasOnboardingOutputSchema>;

export const saasOnboardingRequestSchema = z.object({
  input: saasOnboardingInputSchema,
  operationMetadata: RequestMetadataSchema,
  status: RequestStatusEnum,
  logs: z.array(RequestLogSchema).optional(),
  output: saasOnboardingOutputSchema.optional(),
  errorMessage: z.string().optional(),
});

export const decodedSaasOnboardingRequestSchema =
  saasOnboardingRequestSchema.extend({
    id: z.string(),
    createdAt: z.instanceof(Timestamp),
    updatedAt: z.instanceof(Timestamp),
  });

export type DecodedSaasOnboardingRequest = z.infer<
  typeof decodedSaasOnboardingRequestSchema
>;

export const saasOnboardingRequestConverter = firestoreTypeConverter(
  decodedSaasOnboardingRequestSchema,
);

/** RequestDoc コレクションパス (操作者の org 配下) */
export function getSaasOnboardingCollectionPath(
  operatorOrganizationId: string,
): string {
  return `organizations/${operatorOrganizationId}/requests/saasOnboarding/logs`;
}
