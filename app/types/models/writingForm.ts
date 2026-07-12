import type { SelectedKnowledgeRef } from "@utils/consultationKnowledge";

export type WritingPhase = "format_review" | "filling" | "done";

export type WritingFieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "select";

export interface WritingFormField {
  key: string;
  label: string;
  type: WritingFieldType;
  required?: boolean;
  hint?: string;
  /** ユーザーが項目ごとに指定する ADK 向け追加指示 */
  customInstruction?: string;
  options?: string[];
  value?: string;
}

export interface WritingFormState {
  title?: string;
  fields: WritingFormField[];
  schemaConfirmedAt?: string | null;
}

export type WritingReferenceSource = "knowledge" | "clipboard" | "upload";

export type WritingReferenceStatus = "draft" | "complete";

export interface WritingReferenceAttachment {
  id: string;
  source: WritingReferenceSource;
  name: string;
  mimeType: string;
  gcsPath?: string;
  storageUrl?: string;
  knowledgeDocId?: string;
}

export interface WritingReferenceState {
  status: WritingReferenceStatus;
  attachments: WritingReferenceAttachment[];
  selectedKnowledge: SelectedKnowledgeRef[];
}

export type WritingInvokeAction = "extract_schema" | "generate_document";
