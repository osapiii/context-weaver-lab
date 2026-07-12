import { z } from "zod";
import type { AttachedFile } from "@adapters/masterEditor/types";
import type { Document } from "@models/document";
import type {
  KnowledgeAsset,
  KnowledgeAssetRole,
  KnowledgeAssetSource,
} from "@models/knowledgeAsset";
import type { WritingReferenceState } from "@models/writingForm";
import type { ImageReferenceState } from "@utils/imageReference";
import { resolveStorageBucketName } from "@utils/adkAttachments";
import {
  documentToSelectedKnowledge,
  knowledgeDocumentKey,
  type SelectedKnowledgeRef,
} from "@utils/consultationKnowledge";

export const StateContextAssetSchema = z.object({
  id: z.string(),
  documentId: z.string().optional(),
  name: z.string(),
  mimeType: z.string(),
  gcsPath: z.string().regex(/^gs:\/\//),
  kind: z.enum(["indexed", "ephemeral"]),
  role: z.enum([
    "turn_attachment",
    "reference_image",
    "workspace_reference",
    "pinned_knowledge",
  ]),
});

export type StateContextAsset = z.infer<typeof StateContextAssetSchema>;

export const toStateContextAsset = (params: {
  asset: KnowledgeAsset;
  role: KnowledgeAssetRole;
}): StateContextAsset => ({
  id: params.asset.id,
  documentId: params.asset.documentId,
  name: params.asset.name,
  mimeType: params.asset.mimeType || "application/octet-stream",
  gcsPath: params.asset.gcsPath,
  kind: params.asset.kind,
  role: params.role,
});

export const toStateContextAssets = (params: {
  assets: KnowledgeAsset[];
  role: KnowledgeAssetRole;
}): StateContextAsset[] =>
  params.assets
    .filter((asset) => asset.gcsPath?.trim())
    .map((asset) => toStateContextAsset({ asset, role: params.role }));

export const normalizeStateContextAssets = (
  raw: unknown
): StateContextAsset[] => {
  if (!Array.isArray(raw)) return [];
  const out: StateContextAsset[] = [];
  for (const item of raw) {
    const parsed = StateContextAssetSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
};

export const readContextAssetsFromSessionState = (
  state: Record<string, unknown>
): {
  contextAssets: StateContextAsset[];
  turnContextAssets: StateContextAsset[];
} => ({
  contextAssets: normalizeStateContextAssets(state.context_assets),
  turnContextAssets: normalizeStateContextAssets(state.turn_context_assets),
});

const sourceFromDocument = (doc: Document): KnowledgeAssetSource =>
  doc.subCategory === "fileUpload" ? "upload" : "knowledge";

export const documentToKnowledgeAsset = (
  doc: Document,
  params?: { role?: KnowledgeAssetRole }
): KnowledgeAsset | null => {
  const ref = documentToSelectedKnowledge(doc);
  if (!ref) return null;
  return {
    id: ref.id,
    documentId: knowledgeDocumentKey(doc) || ref.id,
    name: ref.name,
    mimeType: ref.mimeType,
    gcsPath: ref.gcsPath,
    accessUrl: "",
    kind: "indexed",
    registrationStage: "indexed",
    source: sourceFromDocument(doc),
    role: params?.role,
  };
};

export const knowledgeAssetFromUpload = (params: {
  id: string;
  name: string;
  mimeType: string;
  gcsPath: string;
  accessUrl: string;
  source?: KnowledgeAssetSource;
  role?: KnowledgeAssetRole;
}): KnowledgeAsset => ({
  id: params.id,
  name: params.name,
  mimeType: params.mimeType || "application/octet-stream",
  gcsPath: params.gcsPath,
  accessUrl: params.accessUrl,
  kind: "indexed",
  registrationStage: "uploading",
  source: params.source ?? "upload",
  role: params.role,
});

export const attachedFileToKnowledgeAsset = (params: {
  file: AttachedFile;
  index: number;
}): KnowledgeAsset | null => {
  const { file, index } = params;
  if (!file.gcsPath?.trim()) return null;
  const gcsPath = file.gcsPath.startsWith("gs://")
    ? file.gcsPath
    : `gs://${resolveStorageBucketName()}/${file.gcsPath.replace(/^\/+/, "")}`;
  return {
    id: `turn_${index}_${file.fileName}`.slice(0, 80),
    name: file.fileName,
    mimeType: file.mimeType || "application/octet-stream",
    gcsPath,
    accessUrl: "",
    kind: "indexed",
    source: "upload",
    role: "turn_attachment",
  };
};

export const selectedKnowledgeToKnowledgeAsset = (
  item: SelectedKnowledgeRef
): KnowledgeAsset => ({
  id: item.id,
  documentId: item.id,
  name: item.name,
  mimeType: item.mimeType,
  gcsPath: item.gcsPath,
  accessUrl: "",
  kind: "indexed",
  source: "knowledge",
  role: "turn_attachment",
});

export const buildPersistedContextAssets = (params: {
  writingReferenceState?: WritingReferenceState;
  imageReferenceState?: ImageReferenceState;
  turnContextAssets?: KnowledgeAsset[];
}): {
  contextAssets: StateContextAsset[];
  turnContextAssets: StateContextAsset[];
} => {
  const contextAssets: StateContextAsset[] = [];
  if (params.writingReferenceState?.status === "complete") {
    contextAssets.push(
      ...toStateContextAssets({
        assets: params.writingReferenceState.attachments,
        role: "workspace_reference",
      })
    );
  }
  if (params.imageReferenceState?.status === "complete") {
    for (const ref of params.imageReferenceState.references) {
      if (!ref.gcsPath?.trim()) continue;
      contextAssets.push(
        toStateContextAsset({
          asset: {
            id: ref.id,
            documentId: ref.knowledgeDocId,
            name: ref.name,
            mimeType: ref.mimeType,
            gcsPath: ref.gcsPath,
            accessUrl: ref.storageUrl ?? "",
            kind: "indexed",
            source: ref.source,
          },
          role: "reference_image",
        })
      );
    }
  }
  const turnContextAssets = toStateContextAssets({
    assets: params.turnContextAssets ?? [],
    role: "turn_attachment",
  });
  return { contextAssets, turnContextAssets };
};

export const ephemeralKnowledgeAsset = (params: {
  id: string;
  name: string;
  mimeType: string;
  gcsPath: string;
  accessUrl: string;
  source?: KnowledgeAssetSource;
}): KnowledgeAsset => ({
  id: params.id,
  name: params.name,
  mimeType: params.mimeType || "application/octet-stream",
  gcsPath: params.gcsPath,
  accessUrl: params.accessUrl,
  kind: "ephemeral",
  source: params.source ?? "crop",
});
