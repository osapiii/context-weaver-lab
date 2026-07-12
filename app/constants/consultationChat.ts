import type { LlmModelSelection } from "@models/llmModelSelection";
import { CONSULTATION_DEFAULT_LLM_MODEL } from "@constants/consultationLlmModels";

/** @deprecated CONSULTATION_DEFAULT_LLM_MODEL を使用 */
export const CONSULTATION_CHAT_MODEL = CONSULTATION_DEFAULT_LLM_MODEL;

export type ConsultationChatModel = LlmModelSelection;

/** 組織ナレッジに加え Google Search grounding を有効化 */
export const CONSULTATION_ENABLE_WEB_SEARCH = true;

