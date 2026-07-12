import { z } from "zod";
import { firestoreTypeConverter } from "./firestoreTypeConverter";
import { Timestamp } from "firebase/firestore";

/**
 * Space Base Schema (Input)
 * 新規作成時に必要なフィールド
 */
export const SpaceBaseSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().optional(),
  organizationId: z.string(),
  createdBy: z.string(),
  isDefault: z.boolean().default(false),
});

/**
 * Space Decoded Schema
 * Firestoreから読み取る際の完全なスキーマ
 */
export const SpaceDecodedSchema = SpaceBaseSchema.extend({
  id: z.string(),
  createdAt: z.instanceof(Timestamp),
  updatedAt: z.instanceof(Timestamp),
  deletedAt: z.instanceof(Timestamp).optional(),
});

/**
 * Space Input Schema
 * 新規作成時の入力型
 */
export const SpaceInputSchema = SpaceBaseSchema.omit({
  organizationId: true,
  createdBy: true,
});

/**
 * Space Update Schema
 * 更新時の入力型
 */
export const SpaceUpdateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().optional(),
  isDefault: z.boolean().optional(),
});

// 型定義
export type Space = z.infer<typeof SpaceDecodedSchema>;
export type SpaceInput = z.infer<typeof SpaceInputSchema>;
export type SpaceUpdate = z.infer<typeof SpaceUpdateSchema>;

// Firestore Converter
export const spaceConverter = firestoreTypeConverter(SpaceDecodedSchema);

/**
 * Space Collection Path Generator
 * @param organizationId - Organization ID
 * @returns Firestore collection path for Spaces
 */
export function getSpaceCollectionPath(organizationId: string): string {
  return `organizations/${organizationId}/spaces`;
}

/**
 * Space Document Path Generator
 * @param organizationId - Organization ID
 * @param spaceId - Space ID
 * @returns Firestore document path for a specific Space
 */
export function getSpaceDocumentPath(
  organizationId: string,
  spaceId: string
): string {
  return `organizations/${organizationId}/spaces/${spaceId}`;
}
