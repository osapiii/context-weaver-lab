import { Timestamp } from "firebase/firestore";
import { z } from "zod";
import { firestoreTypeConverter } from "./firestoreTypeConverter";

export const AdkSessionArtifactStatusEnum = z.enum([
  "syncing",
  "ready",
  "failed",
]);

export const AdkSessionArtifactSchema = z.object({
  artifactId: z.string(),
  sessionId: z.string(),
  organizationId: z.string(),
  spaceId: z.string(),
  uid: z.string(),
  kind: z.string(),
  adkFilename: z.string(),
  adkVersion: z.number(),
  sourceGcsPath: z.string(),
  storageGcsPath: z.string(),
  contentType: z.string().default("application/octet-stream"),
  bytes: z.number().default(0),
  name: z.string().optional(),
  prompt: z.string().optional(),
  messageId: z.string().optional(),
  responseId: z.string().optional(),
  status: AdkSessionArtifactStatusEnum.default("syncing"),
  syncError: z.string().optional(),
});

export const DecodedAdkSessionArtifactSchema = AdkSessionArtifactSchema.extend({
  id: z.string(),
  createdAt: z.instanceof(Timestamp).optional(),
  updatedAt: z.instanceof(Timestamp).optional(),
});

export type DecodedAdkSessionArtifact = z.infer<
  typeof DecodedAdkSessionArtifactSchema
>;

export const adkSessionArtifactConverter = firestoreTypeConverter(
  DecodedAdkSessionArtifactSchema
);
