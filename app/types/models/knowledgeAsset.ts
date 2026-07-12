export type KnowledgeAssetKind = "indexed" | "ephemeral";

export type KnowledgeAssetRegistrationStage = "indexed" | "uploading";

export type KnowledgeAssetSource =
  | "knowledge"
  | "upload"
  | "fileSpace"
  | "webCrawl"
  | "crop";

export type KnowledgeAssetRole =
  | "turn_attachment"
  | "reference_image"
  | "workspace_reference"
  | "pinned_knowledge";

export interface KnowledgeAsset {
  id: string;
  documentId?: string;
  name: string;
  mimeType: string;
  gcsPath: string;
  accessUrl: string;
  kind: KnowledgeAssetKind;
  registrationStage?: KnowledgeAssetRegistrationStage;
  source: KnowledgeAssetSource;
  role?: KnowledgeAssetRole;
}
