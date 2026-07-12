import { Timestamp } from "firebase/firestore";
import { z } from "zod";
import { firestoreTypeConverter } from "./firestoreTypeConverter";
import { RequestMetadataSchema } from "./core/operationMetadata";
import { RequestLogSchema, RequestStatusEnum } from "./core/requestStatus";

/** RBAC: 2=システム管理者, 3=利用者 (組織メンバー管理で発行可能) */
export const MemberRbacRoleEnum = z.union([z.literal(2), z.literal(3)]);

export type MemberRbacRole = z.infer<typeof MemberRbacRoleEnum>;

export const memberUserCreateInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  rbacRole: MemberRbacRoleEnum.default(3),
  /** 利用者 (rbacRole=3) の場合にアクセス可能な Space ID 一覧 */
  spaceIds: z.array(z.string()).default([]),
});

export type MemberUserCreateInput = z.infer<typeof memberUserCreateInputSchema>;

export const memberUserCreateOutputSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
});

export const memberUserCreateRequestSchema = z.object({
  input: memberUserCreateInputSchema,
  operationMetadata: RequestMetadataSchema,
  status: RequestStatusEnum,
  logs: z.array(RequestLogSchema).optional(),
  output: memberUserCreateOutputSchema.optional(),
  errorMessage: z.string().optional(),
});

export const decodedMemberUserCreateRequestSchema =
  memberUserCreateRequestSchema.extend({
    id: z.string(),
    createdAt: z.instanceof(Timestamp),
    updatedAt: z.instanceof(Timestamp),
  });

export type DecodedMemberUserCreateRequest = z.infer<
  typeof decodedMemberUserCreateRequestSchema
>;

export const memberUserCreateRequestConverter = firestoreTypeConverter(
  decodedMemberUserCreateRequestSchema,
);

export const memberUserUpdateInputSchema = z.object({
  userId: z.string().min(1),
  email: z.string().email().optional(),
  rbacRole: MemberRbacRoleEnum,
  spaceIds: z.array(z.string()).default([]),
});

export type MemberUserUpdateInput = z.infer<typeof memberUserUpdateInputSchema>;

export const memberUserUpdateOutputSchema = z.object({
  userId: z.string(),
});

export const memberUserUpdateRequestSchema = z.object({
  input: memberUserUpdateInputSchema,
  operationMetadata: RequestMetadataSchema,
  status: RequestStatusEnum,
  logs: z.array(RequestLogSchema).optional(),
  output: memberUserUpdateOutputSchema.optional(),
  errorMessage: z.string().optional(),
});

export const decodedMemberUserUpdateRequestSchema =
  memberUserUpdateRequestSchema.extend({
    id: z.string(),
    createdAt: z.instanceof(Timestamp),
    updatedAt: z.instanceof(Timestamp),
  });

export type DecodedMemberUserUpdateRequest = z.infer<
  typeof decodedMemberUserUpdateRequestSchema
>;

export const memberUserUpdateRequestConverter = firestoreTypeConverter(
  decodedMemberUserUpdateRequestSchema,
);

export const memberUserDeleteInputSchema = z.object({
  userId: z.string().min(1),
});

export type MemberUserDeleteInput = z.infer<typeof memberUserDeleteInputSchema>;

export const memberUserDeleteOutputSchema = z.object({
  userId: z.string(),
});

export const memberUserDeleteRequestSchema = z.object({
  input: memberUserDeleteInputSchema,
  operationMetadata: RequestMetadataSchema,
  status: RequestStatusEnum,
  logs: z.array(RequestLogSchema).optional(),
  output: memberUserDeleteOutputSchema.optional(),
  errorMessage: z.string().optional(),
});

export const decodedMemberUserDeleteRequestSchema =
  memberUserDeleteRequestSchema.extend({
    id: z.string(),
    createdAt: z.instanceof(Timestamp),
    updatedAt: z.instanceof(Timestamp),
  });

export type DecodedMemberUserDeleteRequest = z.infer<
  typeof decodedMemberUserDeleteRequestSchema
>;

export const memberUserDeleteRequestConverter = firestoreTypeConverter(
  decodedMemberUserDeleteRequestSchema,
);

export const MEMBER_USER_CREATE_COLLECTION =
  "requests/memberUserCreate/logs";
export const MEMBER_USER_UPDATE_COLLECTION =
  "requests/memberUserUpdate/logs";
export const MEMBER_USER_DELETE_COLLECTION =
  "requests/memberUserDelete/logs";

export function getMemberUserCreateCollectionPath(organizationId: string): string {
  return `organizations/${organizationId}/${MEMBER_USER_CREATE_COLLECTION}`;
}

export function getMemberUserUpdateCollectionPath(organizationId: string): string {
  return `organizations/${organizationId}/${MEMBER_USER_UPDATE_COLLECTION}`;
}

export function getMemberUserDeleteCollectionPath(organizationId: string): string {
  return `organizations/${organizationId}/${MEMBER_USER_DELETE_COLLECTION}`;
}
