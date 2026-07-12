/**
 * AI Studio セッション履歴タイトルを Gemini で短時間生成する.
 * 失敗時は先頭ユーザーメッセージの切り詰めにフォールバック.
 */
import log from "@utils/logger";
import { useGeminiByokStore } from "@stores/gemini-byok";
import {
  useAiStudioSessions,
  type AiStudioJobKind,
} from "@composables/useAiStudioSessions";

const TITLE_MODEL = "gemini-2.5-flash-lite";
const MAX_TITLE_LENGTH = 28;

const SESSION_TITLE_SYSTEM_PROMPT = `\
あなたはチャット履歴のタイトル生成機です.
ユーザーの最初の発言から、履歴一覧で一目で内容が分かる **日本語の短いタイトル** を 1 つだけ生成してください.

## ルール
- 20 文字以内 (どうしても必要なら最大 28 文字)
- 名詞句または短い疑問形
- 絵文字・引用符・Markdown・句読点の多用は禁止
- タイトルのみを 1 行で出力 (説明・前置き禁止)
`;

export const normalizeSessionTitle = (raw: string): string => {
  const cleaned = raw
    .trim()
    .replace(/^["'「『]+|["'」』]+$/g, "")
    .replace(/\s+/g, " ")
    .replace(/[#*_`]/g, "");
  if (!cleaned) return "";
  return cleaned.length > MAX_TITLE_LENGTH
    ? `${cleaned.slice(0, MAX_TITLE_LENGTH)}…`
    : cleaned;
};

const buildFallbackTitle = (
  firstUserPrompt: string,
  jobKind: AiStudioJobKind
): string => {
  const sessions = useAiStudioSessions();
  return sessions.deriveTitle(
    [{ id: "x", role: "user", text: firstUserPrompt, createdAt: 0 }],
    jobKind
  );
};

export const generateAiStudioSessionTitle = async (
  firstUserPrompt: string,
  jobKind: AiStudioJobKind = null
): Promise<string> => {
  const trimmed = firstUserPrompt.trim();
  const fallback = buildFallbackTitle(trimmed, jobKind);
  if (!trimmed) return fallback;

  try {
    const apiKey = await useGeminiByokStore().resolveApiKey();
    if (!apiKey) return fallback;

    const { GoogleGenAI } = await import("@google/genai");
    const client = new GoogleGenAI({ apiKey });

    const response = await client.models.generateContent({
      model: TITLE_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${SESSION_TITLE_SYSTEM_PROMPT}\n\nユーザーの最初の発言:\n${trimmed}`,
            },
          ],
        },
      ],
      config: {
        temperature: 0.2,
        maxOutputTokens: 64,
      },
    });

    const normalized = normalizeSessionTitle(response.text ?? "");
    return normalized || fallback;
  } catch (error) {
    log("WARN", "[aiStudioSessionTitle] generation failed", error);
    return fallback;
  }
};
