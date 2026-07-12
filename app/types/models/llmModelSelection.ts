import { z } from "zod";

/**
 * RequestDoc `input.model` / ADK invoke `model` で共通利用する選択キー.
 * adkInvokeRequest / ADK エージェントと整合させること。
 */
export const LlmModelSelectionSchema = z.enum([
  "2.5-flash-lite",
  "2.5-flash",
  "3",
  "3-flash",
  "3.1-flash-lite",
  "3.5-flash",
]);

export type LlmModelSelection = z.infer<typeof LlmModelSelectionSchema>;

const API_NAME_BY_SELECTION: Record<LlmModelSelection, string> = {
  "2.5-flash-lite": "gemini-2.5-flash-lite",
  "2.5-flash": "gemini-2.5-flash",
  "3": "gemini-3-pro-preview",
  "3-flash": "gemini-3-flash-preview",
  "3.1-flash-lite": "gemini-3.1-flash-lite",
  "3.5-flash": "gemini-3.5-flash",
};

/** 選択キー or 完全な `gemini-*` API 名 → Generative Language API model id */
export const resolveGeminiApiModelName = (
  model: string | null | undefined
): string | null => {
  if (model == null) return null;
  const trimmed = model.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("gemini-")) return trimmed;
  const parsed = LlmModelSelectionSchema.safeParse(trimmed);
  if (parsed.success) {
    return API_NAME_BY_SELECTION[parsed.data];
  }
  return null;
};

/** ADK mode ごとの既定選択キー (RequestDoc / invoke で model 未指定時) */
export const defaultLlmModelSelectionForAdkMode = (
  mode: string
): LlmModelSelection => {
  if (mode === "guide") return "2.5-flash-lite";
  if (mode === "consultation") return "3.1-flash-lite";
  return "2.5-flash";
};

export const defaultGeminiApiModelForAdkMode = (mode: string): string => {
  const selection = defaultLlmModelSelectionForAdkMode(mode);
  return API_NAME_BY_SELECTION[selection];
};
