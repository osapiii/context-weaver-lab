/** AI Studio 文書モード — Firestore / ADK writing バケット同期 */

import {
  buildGoldenWritingTaskBucket,
  writingGoldenToEffectiveFlat,
} from "@utils/goldenTaskBucket";
import {
  readTaskBucketFromSessionState,
} from "@utils/workspaceSessionBuckets";
import type { AttachedFile } from "@adapters/masterEditor/types";
import type {
  WritingFormField,
  WritingFormState,
  WritingPhase,
  WritingReferenceAttachment,
  WritingReferenceState,
  WritingReferenceStatus,
  WritingFieldType,
} from "@models/writingForm";
import type { SelectedKnowledgeRef } from "@utils/consultationKnowledge";

export const WRITING_PHASE_DEFAULT: WritingPhase = "format_review";

export const emptyWritingFormState = (): WritingFormState => ({
  title: "",
  fields: [],
  schemaConfirmedAt: null,
});

export const MAX_WRITING_REFERENCES = 5;

export const emptyWritingReferenceState = (): WritingReferenceState => ({
  status: "draft",
  attachments: [],
  selectedKnowledge: [],
});

/** Pinia / Firestore 由来で undefined になり得る参照状態を常に正規化する */
export const coalesceWritingReferenceState = (
  raw: WritingReferenceState | null | undefined
): WritingReferenceState =>
  raw ? normalizeWritingReferenceState(raw) : emptyWritingReferenceState();

/** ローカル編集中の参照が Firestore エコーで消えないよう hydrate 時に保持する */
export const shouldPreserveLocalWritingReferenceOnHydrate = (params: {
  local: WritingReferenceState | null | undefined;
  fromRecord: WritingReferenceState;
}): boolean => {
  const local = params.local;
  if (!local) return false;
  if (local.attachments.length > params.fromRecord.attachments.length) {
    return true;
  }
  if (
    local.status === "complete" &&
    params.fromRecord.status === "draft" &&
    local.attachments.length > 0
  ) {
    return true;
  }
  return false;
};

export const writingReferenceStatusLabel = (
  status: WritingReferenceStatus
): string => {
  switch (status) {
    case "complete":
      return "確定済み";
    case "draft":
      return "下書き";
    default:
      return status;
  }
};

export const recomputeWritingReferenceState = (params: {
  attachments: WritingReferenceAttachment[];
  selectedKnowledge?: SelectedKnowledgeRef[];
  forceStatus?: WritingReferenceStatus;
}): WritingReferenceState => {
  const attachments = params.attachments.slice(0, MAX_WRITING_REFERENCES);
  const selectedKnowledge = params.selectedKnowledge ?? [];
  if (params.forceStatus === "complete" && attachments.length > 0) {
    return {
      status: "complete",
      attachments,
      selectedKnowledge,
    };
  }
  if (attachments.length === 0 && selectedKnowledge.length === 0) {
    return { status: "draft", attachments: [], selectedKnowledge: [] };
  }
  return {
    status: params.forceStatus ?? "draft",
    attachments,
    selectedKnowledge,
  };
};

const FIELD_TYPES: WritingFieldType[] = [
  "text",
  "textarea",
  "number",
  "date",
  "select",
];

const normalizeField = (raw: unknown): WritingFormField | null => {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const key =
    (typeof obj.key === "string" && obj.key.trim()) ||
    (typeof obj.field_key === "string" && obj.field_key.trim()) ||
    "";
  const label =
    (typeof obj.label === "string" && obj.label.trim()) || key;
  if (!key) return null;
  let type = (obj.type as WritingFieldType) || "text";
  if (!FIELD_TYPES.includes(type)) type = "text";
  const field: WritingFormField = {
    key: key.trim(),
    label: label.trim(),
    type,
    required: obj.required === true,
  };
  if (typeof obj.hint === "string" && obj.hint.trim()) {
    field.hint = obj.hint.trim();
  }
  const customInstruction =
    (typeof obj.customInstruction === "string" && obj.customInstruction.trim()) ||
    (typeof obj.custom_instruction === "string" && obj.custom_instruction.trim()) ||
    "";
  if (customInstruction) {
    field.customInstruction = customInstruction;
  }
  if (Array.isArray(obj.options)) {
    field.options = obj.options
      .filter((o): o is string => typeof o === "string" && o.trim())
      .map((o) => o.trim());
  }
  const value =
    typeof obj.value === "string"
      ? obj.value
      : obj.value != null
        ? String(obj.value)
        : undefined;
  if (value !== undefined) field.value = value;
  return field;
};

export const normalizeWritingFormState = (raw: unknown): WritingFormState => {
  if (!raw || typeof raw !== "object") return emptyWritingFormState();
  const obj = raw as Record<string, unknown>;
  const fields: WritingFormField[] = [];
  const rawFields = obj.fields;
  if (Array.isArray(rawFields)) {
    for (const item of rawFields) {
      const field = normalizeField(item);
      if (field) fields.push(field);
    }
  }
  const title =
    typeof obj.title === "string" ? obj.title.trim() : undefined;
  const schemaConfirmedAt =
    typeof obj.schema_confirmed_at === "string"
      ? obj.schema_confirmed_at
      : typeof obj.schemaConfirmedAt === "string"
        ? obj.schemaConfirmedAt
        : null;
  return {
    title: title || undefined,
    fields,
    schemaConfirmedAt,
  };
};

const normalizeAttachment = (
  raw: unknown
): WritingReferenceAttachment | null => {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const id =
    (typeof obj.id === "string" && obj.id) ||
    `wref_${Math.random().toString(36).slice(2, 10)}`;
  const source = obj.source;
  if (source !== "knowledge" && source !== "clipboard" && source !== "upload") {
    return null;
  }
  const name = typeof obj.name === "string" ? obj.name : "参考資料";
  const mimeType =
    (typeof obj.mimeType === "string" && obj.mimeType) ||
    (typeof obj.mime_type === "string" && obj.mime_type) ||
    "application/octet-stream";
  const att: WritingReferenceAttachment = {
    id,
    source,
    name,
    mimeType,
  };
  const gcsPath =
    (typeof obj.gcsPath === "string" && obj.gcsPath) ||
    (typeof obj.gcs_path === "string" && obj.gcs_path) ||
    undefined;
  if (gcsPath) att.gcsPath = gcsPath;
  const storageUrl =
    (typeof obj.storageUrl === "string" && obj.storageUrl) ||
    (typeof obj.storage_url === "string" && obj.storage_url) ||
    undefined;
  if (storageUrl) att.storageUrl = storageUrl;
  const knowledgeDocId =
    (typeof obj.knowledgeDocId === "string" && obj.knowledgeDocId) ||
    (typeof obj.knowledge_doc_id === "string" && obj.knowledge_doc_id) ||
    undefined;
  if (knowledgeDocId) att.knowledgeDocId = knowledgeDocId;
  return att;
};

export const normalizeWritingReferenceState = (
  raw: unknown
): WritingReferenceState => {
  if (!raw || typeof raw !== "object") return emptyWritingReferenceState();
  const obj = raw as Record<string, unknown>;
  let status = (obj.status as WritingReferenceStatus) || "draft";
  if (status !== "draft" && status !== "complete") status = "draft";
  const attachments: WritingReferenceAttachment[] = [];
  const rawAtt = obj.attachments;
  if (Array.isArray(rawAtt)) {
    for (const item of rawAtt) {
      const att = normalizeAttachment(item);
      if (att) attachments.push(att);
    }
  }
  const selectedKnowledge: SelectedKnowledgeRef[] = [];
  const rawKn =
    obj.selected_knowledge ?? obj.selectedKnowledge;
  if (Array.isArray(rawKn)) {
    for (const item of rawKn) {
      if (!item || typeof item !== "object") continue;
      const k = item as Record<string, unknown>;
      const id = typeof k.id === "string" ? k.id : "";
      const name = typeof k.name === "string" ? k.name : "";
      const gcsPath =
        (typeof k.gcsPath === "string" && k.gcsPath) ||
        (typeof k.gcs_path === "string" && k.gcs_path) ||
        "";
      if (!id || !gcsPath) continue;
      selectedKnowledge.push({
        id,
        name,
        gcsPath,
        mimeType:
          (typeof k.mimeType === "string" && k.mimeType) ||
          (typeof k.mime_type === "string" && k.mime_type) ||
          "application/octet-stream",
      });
    }
  }
  return { status, attachments, selectedKnowledge };
};

export const normalizeWritingPhase = (raw: unknown): WritingPhase => {
  if (raw === "filling" || raw === "done" || raw === "format_review") {
    return raw;
  }
  return WRITING_PHASE_DEFAULT;
};

export const resolveWritingFieldsFromRecord = (params: {
  state: Record<string, unknown>;
}): {
  writingPhase: WritingPhase;
  writingForm: WritingFormState;
  writingReferenceState: WritingReferenceState;
} => {
  const apiWriting = readTaskBucketFromSessionState(params.state, "writing");
  const flatWriting = writingGoldenToEffectiveFlat(apiWriting);
  return {
    writingPhase: normalizeWritingPhase(flatWriting.writing_phase),
    writingForm: normalizeWritingFormState(flatWriting.writing_form),
    writingReferenceState: normalizeWritingReferenceState(
      flatWriting.writing_reference
    ),
  };
};

export const writingHasReferenceMaterial = (params: {
  referenceState: WritingReferenceState;
  attachmentCount: number;
}): boolean => {
  if (params.referenceState.status !== "complete") return false;
  return (
    params.referenceState.attachments.length > 0 ||
    params.referenceState.selectedKnowledge.length > 0 ||
    params.attachmentCount > 0
  );
};

export const writingFormHasRequiredValues = (
  form: WritingFormState
): boolean => {
  for (const field of form.fields) {
    if (!field.required) continue;
    const value = (field.value ?? "").trim();
    if (!value) return false;
  }
  return form.fields.length > 0;
};

import type { AgentSseArtifact } from "@composables/useAgentSseClient";

/** json_document 本文をパース（field key → value） */
export const parseWritingJsonPayload = (
  body: string
): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(body) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* ignore */
  }
  return {};
};

/** メッセージ履歴から最新の json_document Artifact ref を取得 */
export const findLatestWritingJsonArtifact = (params: {
  messages: ReadonlyArray<{ role: string; artifacts?: AgentSseArtifact[] }>;
}): AgentSseArtifact | null => {
  for (let i = params.messages.length - 1; i >= 0; i -= 1) {
    const message = params.messages[i];
    if (message?.role !== "assistant" || !message.artifacts?.length) continue;
    for (let j = message.artifacts.length - 1; j >= 0; j -= 1) {
      const artifact = message.artifacts[j];
      if (artifact?.kind === "json_document") return artifact;
    }
  }
  return null;
};

/** フォーム定義 + JSON payload から表示用フィールドを組み立て */
export const mergeWritingFieldsWithJsonPayload = (params: {
  fields: WritingFormField[];
  payload: Record<string, unknown>;
}): WritingFormField[] =>
  params.fields.map((field) => {
    const raw = params.payload[field.key];
    if (raw == null) return field;
    const value = typeof raw === "string" ? raw : String(raw);
    return { ...field, value };
  });

/** JSON 成果物 (add_json_document) からフォーム value を反映 — inline body のみ */
export const mergeWritingFormValuesFromJsonArtifact = (params: {
  form: WritingFormState;
  artifacts?: ReadonlyArray<{ kind?: string; body?: string | null }> | null;
}): WritingFormState => {
  const artifacts = params.artifacts ?? [];
  let payload: Record<string, unknown> | null = null;
  for (const artifact of artifacts) {
    if (artifact.kind !== "json_document" || !artifact.body?.trim()) continue;
    payload = parseWritingJsonPayload(artifact.body);
    if (Object.keys(payload).length > 0) break;
  }
  if (!payload || Object.keys(payload).length < 1) return params.form;
  return {
    ...params.form,
    fields: mergeWritingFieldsWithJsonPayload({
      fields: params.form.fields,
      payload,
    }),
  };
};

/** ADK invoke 用 mode_state — golden `state.writing` バケット + instruction 用 flat action */
export const writingModeStateToApi = (params: {
  writingPhase: WritingPhase;
  writingForm: WritingFormState;
  writingReferenceState: WritingReferenceState;
  writingAction?: "extract_schema" | "generate_document" | null;
}): Record<string, unknown> => {
  const out: Record<string, unknown> = {
    active_mode: "writing",
    writing: buildGoldenWritingTaskBucket(params),
  };
  if (params.writingAction) {
    out.writing_action = params.writingAction;
  }
  return out;
};

export const buildWritingReferenceFromAttachments = (params: {
  attachments: AttachedFile[];
  selectedKnowledge: SelectedKnowledgeRef[];
  status: WritingReferenceStatus;
}): WritingReferenceState => {
  const attachments: WritingReferenceAttachment[] = [];
  params.attachments.forEach((file, index) => {
    if (!file.gcsPath?.trim()) return;
    attachments.push({
      id: `watt_${index}_${file.fileName}`.slice(0, 80),
      source: "upload",
      name: file.fileName,
      mimeType: file.mimeType || "application/octet-stream",
      gcsPath: file.gcsPath,
    });
  });
  return {
    status: params.status,
    attachments,
    selectedKnowledge: [...params.selectedKnowledge],
  };
};

export const countWritingReferenceMaterial = (params: {
  referenceState: WritingReferenceState;
  pendingAttachments: number;
}): number =>
  params.referenceState.attachments.length +
  params.referenceState.selectedKnowledge.length +
  params.pendingAttachments;

export const clearedWritingModeStateFragment = (): Record<string, unknown> => ({
  mode_state: { active_mode: "writing" },
  writing: {
    writing_phase: WRITING_PHASE_DEFAULT,
    writing_form: { title: "", fields: [], schema_confirmed_at: null },
    writing_reference: {
      status: "draft",
      attachments: [],
      selected_knowledge: [],
    },
  },
});

const slugifyFieldKey = (params: { label: string; index: number }): string => {
  const base = params.label
    .trim()
    .toLowerCase()
    .replace(/[^\w\u3040-\u30ff\u3400-\u9fff]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return base || `field_${params.index + 1}`;
};

export const createEmptyWritingFormField = (params: {
  index: number;
}): WritingFormField => ({
  key: slugifyFieldKey({ label: `field_${params.index + 1}`, index: params.index }),
  label: "新しい項目",
  type: "text",
  required: false,
});

/** generate_document 用ユーザープロンプト — 項目別カスタム指示を付与 */
export const buildWritingGenerateDocumentPrompt = (params: {
  form: WritingFormState;
}): string => {
  const base =
    "確定済みフォームの各項目について、search_knowledge（AgentSearch）で社内ナレッジを参照し値を調査・生成し、JSON 成果物として返してください。";
  const lines = params.form.fields
    .map((field) => {
      const instruction = field.customInstruction?.trim();
      if (!instruction) return null;
      return `- ${field.label.trim()} (${field.key}): ${instruction}`;
    })
    .filter((line): line is string => Boolean(line));
  if (lines.length < 1) return base;
  return `${base}\n\n【項目別の追加指示】\n${lines.join("\n")}`;
};
