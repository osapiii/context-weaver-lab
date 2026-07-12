import type { LlmModelSelection } from "@models/llmModelSelection";

/** 経営相談の既定モデル (コストと品質のバランス) */
export const CONSULTATION_DEFAULT_LLM_MODEL: LlmModelSelection = "3.1-flash-lite";

export type ConsultationLlmModelOption = {
  value: LlmModelSelection;
  label: string;
  description: string;
};

/** 経営相談モデルピッカー用 (RequestDoc `input.model` / ADK invoke と同一キー) */
export const CONSULTATION_LLM_MODEL_OPTIONS: ConsultationLlmModelOption[] = [
  {
    value: "2.5-flash-lite",
    label: "高速",
    description: "2.5 Flash Lite — 応答が最も速い",
  },
  {
    value: "2.5-flash",
    label: "標準",
    description: "2.5 Flash — バランス型",
  },
  {
    value: "3.1-flash-lite",
    label: "推奨",
    description: "3.1 Flash Lite — 経営相談向け (既定)",
  },
  {
    value: "3.5-flash",
    label: "高精度",
    description: "3.5 Flash — 深い推論向け",
  },
  {
    value: "3-flash",
    label: "3 Flash",
    description: "3 Flash Preview",
  },
  {
    value: "3",
    label: "3 Pro",
    description: "3 Pro Preview — 最高品質・遅め",
  },
];

export const consultationLlmModelLabel = (
  value: LlmModelSelection
): string =>
  CONSULTATION_LLM_MODEL_OPTIONS.find((o) => o.value === value)?.label ?? value;
