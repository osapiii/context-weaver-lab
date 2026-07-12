import log from "@utils/logger";
import { zodToJsonSchema } from "@utils/zod-to-json-schema";
import {
  businessPartnerAssistantPatchZodObject,
  type BusinessPartnerAssistantPatch,
  type BusinessPartnerFormSnapshot,
} from "@models/businessPartnerFormAssistant";
import {
  classifyBusinessPartnerAssistantIntent,
  type BusinessPartnerAssistantRoute,
} from "@utils/businessPartnerAssistantRouting";

/**
 * Gemini 3 系: googleSearch + structured output 併用可 (Preview).
 * 初回は短いタイムアウトで fail-fast し、遅延・未提供時は 2.5 へ.
 */
const STRUCTURED_SEARCH_MODEL = "gemini-3.5-flash";

/** 構造化出力・ローカル補完・フォールバック共通 */
const FALLBACK_MODEL = "gemini-2.5-flash";

const TOTAL_TIMEOUT_MS = 55_000;
const STRUCTURED_SEARCH_ATTEMPT_MS = 15_000;

const ASSISTANT_PATCH_JSON_SCHEMA = zodToJsonSchema(
  businessPartnerAssistantPatchZodObject
);

/** googleSearch 併用不可モデル向け: テキストから JSON を抽出 */
const extractJsonText = (raw: string): string => {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```json\s*([\s\S]*?)\s*```/);
  if (fenced) return fenced[1].trim();

  const stripped = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  if (stripped !== trimmed) return stripped;

  const brace = trimmed.match(/\{[\s\S]*\}/);
  return brace ? brace[0] : trimmed;
};

class AssistantTimeoutError extends Error {
  constructor(
    readonly phase: string,
    readonly timeoutMs: number
  ) {
    super(`TIMEOUT:${phase}:${timeoutMs}`);
    this.name = "AssistantTimeoutError";
  }
}

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  phase: string
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new AssistantTimeoutError(phase, timeoutMs)),
          timeoutMs
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

/** Gemini 3 以外・旧 API 制約で structured + googleSearch が拒否されたとき */
const shouldFallbackFromStructuredSearch = (e: unknown): boolean => {
  if (e instanceof AssistantTimeoutError) return true;
  const msg = e instanceof Error ? e.message : String(e);
  if (
    /controlled generation|not supported with google_search|google_search tool/i.test(
      msg
    )
  ) {
    return true;
  }
  if (/404|NOT_FOUND/i.test(msg)) return true;
  if (/\b400\b/.test(msg)) return true;
  return false;
};

const formatApiError = (e: unknown): string => {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("API キー")) return msg;
  if (/TIMEOUT:/.test(msg)) {
    return "AI の応答がタイムアウトしました（約1分）。通信状況を確認してから再試行してください。";
  }
  if (/mime type|unsupported/i.test(msg)) {
    return "Web 検索付き AI の応答形式でエラーが発生しました。もう一度お試しください。";
  }
  if (/quota|429|rate limit/i.test(msg)) {
    return "API の利用上限に達した可能性があります。しばらく待ってから再試行してください。";
  }
  if (/401|403|permission|invalid.*key/i.test(msg)) {
    return "Gemini API キーが無効か権限がありません。設定 → AI 連携 を確認してください。";
  }
  const short = msg.length > 160 ? `${msg.slice(0, 160)}…` : msg;
  return `AI の呼び出しに失敗しました。${short}`;
};

const parseAssistantPatch = (
  raw: string | undefined
): BusinessPartnerAssistantPatch | null => {
  if (!raw?.trim()) {
    return null;
  }

  let jsonPayload: unknown;
  try {
    jsonPayload = JSON.parse(extractJsonText(raw));
  } catch (parseErr) {
    log("WARN", "[businessPartnerFormAssistant] JSON.parse failed", {
      parseErr,
      rawPreview: raw.slice(0, 400),
    });
    return null;
  }

  const parsed = businessPartnerAssistantPatchZodObject.safeParse(jsonPayload);
  if (!parsed.success) {
    log("WARN", "[businessPartnerFormAssistant] zod failed", parsed.error);
    return null;
  }

  return parsed.data;
};

export type BusinessPartnerReviewSubStep =
  | "required"
  | "addressAndCompany"
  | "contact"
  | "all";

const SUB_STEP_LABELS: Record<BusinessPartnerReviewSubStep, string> = {
  required: "必須情報",
  addressAndCompany: "所在地・会社概要",
  contact: "連絡先（任意）",
  all: "全項目（確認・編集）",
};

const ALL_FORM_FIELD_KEYS = [
  "code",
  "name",
  "tradeName",
  "tradeNameKana",
  "corporateNumber",
  "postalCode",
  "prefecture",
  "city",
  "streetAddress",
  "address",
  "representativeName",
  "representativeTitle",
  "foundedDate",
  "capitalStock",
  "industry",
  "employeeCount",
  "businessSummary",
  "contactPerson",
  "phoneNumber",
  "email",
  "website",
  "note",
] as const;

const ensureGeminiClient = async () => {
  return useGeminiByokStore().ensureGeminiClient();
};

const buildAllFieldsEnrichPrompt = (
  snapshot: BusinessPartnerFormSnapshot,
  websiteUrl: string,
  options: { structuredOutput?: boolean }
): string => {
  const known = Object.entries(snapshot)
    .filter(([, v]) => typeof v === "string" && v.trim().length > 0)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

  const fieldList = ALL_FORM_FIELD_KEYS.map((k) => `- ${k}`).join("\n");

  const outputSection = options.structuredOutput
    ? `## 出力
comment に補完内容の説明 (1〜2文・日本語)。
fields には空欄として補完できた項目を積極的に含める。既に値があるキーは省略する。`
    : `## 出力
説明文は不要。次の JSON オブジェクトのみを出力 (コードフェンス不要)。
fields には確認・生成できた項目だけ含める。`;

  return `あなたは EN AIstudio の取引先マスタ登録アシスタントです。
公式サイト URL と公開 Web 検索で事実を裏取りし、取引先フォームの**空欄を可能な限りすべて**補完してください。

## 公式サイト URL
${websiteUrl.trim() || "(未指定)"}

## 補完対象フィールド (すべて)
${fieldList}

## 既知のフォーム値 (既に値がある項目は fields に含めない)
${known || "(lookup 直後 — 空欄を優先して埋める)"}

## ルール
- 推測で埋めない。Web 検索・公式サイトで確認できた事実のみ fields に入れる
- code: 商号・法人番号・種別から一貫した短い識別子 (例: SUP-001)。既に code がある場合は省略
- 法人番号は半角数字13桁。設立日は yyyy-mm-dd
- 住所は prefecture / city / streetAddress に分割。address は結合住所でも可
- capitalStock は円単位の数値文字列 (例: 10000000)
- contactPerson / phoneNumber / email は問い合わせ・会社概要ページから
- businessSummary は事業内容を2〜4文で
- comment には何を補完したか1〜2文で日本語説明
- 見つからなかった項目は fields に含めない

${outputSection}`;
};

const buildSystemPrompt = (
  snapshot: BusinessPartnerFormSnapshot,
  subStep: BusinessPartnerReviewSubStep,
  options: {
    route: BusinessPartnerAssistantRoute;
    structuredOutput?: boolean;
  }
): string => {
  if (subStep === "all") {
    return buildAllFieldsEnrichPrompt(snapshot, snapshot.website ?? "", options);
  }
  const known = Object.entries(snapshot)
    .filter(([, v]) => typeof v === "string" && v.trim().length > 0)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

  const isLocal = options.route === "local_fill";

  const outputSection = options.structuredOutput
    ? `## 出力
comment に補完内容の説明 (1〜2文・日本語)。
fields には指示に沿った項目だけ含める。空のキーは省略する。`
    : `## 出力
説明文は不要。次の JSON オブジェクトのみを出力 (コードフェンス不要)。

{
  "comment": "何を補完したか1〜2文 (日本語)",
  "fields": {
    "code": "取引先コード (任意)",
    "name": "商号",
    "tradeName": "正式商号",
    "corporateNumber": "13桁",
    "postalCode": "123-4567",
    "prefecture": "都道府県",
    "city": "市区町村",
    "streetAddress": "番地以降",
    "capitalStock": "円単位の数値文字列",
    "representativeName": "代表者名",
    "foundedDate": "yyyy-mm-dd",
    "website": "https://..."
  }
}

fields には確認・生成できた項目だけ含める。空のキーは省略する。`;

  const roleSection = isLocal
    ? `あなたは EN AIstudio の取引先マスタ登録アシスタントです。
ユーザーの指示に従い、**既にフォームにある情報だけ**を使って空欄を補完してください。
Web 検索は行わない。外部の事実確認はしない。`
    : `あなたは EN AIstudio の取引先マスタ登録アシスタントです。
ユーザーの指示に従い、公開 Web 検索で事実を裏取りし、取引先フォームの空欄を補完してください。`;

  const rulesSection = isLocal
    ? `## ルール
- 取引先コード (code): 既存の code / 法人番号 / 商号から一貫した短い識別子を提案 (例: 法人番号下6桁、ローマ字略称+連番)。既に code がある場合は fields に含めない
- 推測で外部企業情報 (代表者・資本金・住所など) を埋めない
- 法人番号は半角数字13桁。設立日は yyyy-mm-dd
- comment には何を補完したか1〜2文で日本語説明
- 生成できない項目は fields に含めない`
    : `## ルール
- 推測で埋めない。Web 検索で確認できた事実のみ fields に入れる
- 法人番号は半角数字13桁。設立日は yyyy-mm-dd
- 住所は prefecture / city / streetAddress に分割 (都道府県・市区町村・番地)
- capitalStock は円単位の数値文字列 (例: 10000000)
- comment には何を補完したか1〜2文で日本語説明
- 見つからなかった項目は fields に含めない`;

  return `${roleSection}

## 現在のサブステップ
「${SUB_STEP_LABELS[subStep]}」に関連するフィールドを優先して補完する。

## 既知のフォーム値 (空欄は上書き可、既に値がある項目は fields に含めない)
${known || "(まだ入力なし)"}

${rulesSection}

${outputSection}`;
};

type GeminiClient = Awaited<ReturnType<typeof ensureGeminiClient>>;

const callStructuredSearch = async (
  client: GeminiClient,
  prompt: string,
  signal?: AbortSignal
) => {
  return client.models.generateContent({
    model: STRUCTURED_SEARCH_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: ASSISTANT_PATCH_JSON_SCHEMA,
      temperature: 0.2,
      abortSignal: signal,
    },
  });
};

const callStructuredLocal = async (
  client: GeminiClient,
  prompt: string,
  signal?: AbortSignal
) => {
  return client.models.generateContent({
    model: FALLBACK_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: ASSISTANT_PATCH_JSON_SCHEMA,
      temperature: 0.2,
      abortSignal: signal,
    },
  });
};

const callTextSearchFallback = async (
  client: GeminiClient,
  prompt: string,
  signal?: AbortSignal
) => {
  return client.models.generateContent({
    model: FALLBACK_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      tools: [{ googleSearch: {} }],
      temperature: 0.2,
      abortSignal: signal,
    },
  });
};

const shouldSkipGemini35 = (): boolean => {
  const cfg = useRuntimeConfig();
  const flag = (cfg.public as Record<string, unknown>)
    .businessPartnerAssistantSkipGemini35;
  return flag === true || flag === "true" || flag === "1";
};

export const useBusinessPartnerFormAssistant = () => {
  const isLoading = ref(false);
  const lastError = ref<string | null>(null);
  let pendingAbort: AbortController | null = null;

  const cancelPending = () => {
    pendingAbort?.abort();
    pendingAbort = null;
    isLoading.value = false;
  };

  /**
   * URL lookup 成功後に全フィールドを一括補完 (Web 検索優先).
   */
  const enrichAllFieldsFromUrl = async (params: {
    snapshot: BusinessPartnerFormSnapshot;
    websiteUrl: string;
  }): Promise<BusinessPartnerAssistantPatch | null> => {
    cancelPending();
    pendingAbort = new AbortController();
    const { signal } = pendingAbort;

    isLoading.value = true;
    lastError.value = null;

    const startedAt = performance.now();
    const userTail =
      "## 自動登録指示\n" +
      "上記の公式サイト URL と公開情報から、取引先マスタの全フィールドを可能な限り正確に補完してください。" +
      "代表者・資本金・設立日・業種・従業員数・事業概要・連絡先 (担当者, 電話, メール) も含めてください。";

    log("INFO", "[businessPartnerFormAssistant] enrichAllFieldsFromUrl start", {
      websiteUrl: params.websiteUrl.slice(0, 80),
    });

    const logDone = (ok: boolean, detail?: string) => {
      log("INFO", "[businessPartnerFormAssistant] enrichAllFieldsFromUrl done", {
        ok,
        durationMs: Math.round(performance.now() - startedAt),
        detail,
      });
    };

    const assertNotAborted = () => {
      if (signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
    };

    try {
      const client = await ensureGeminiClient();
      assertNotAborted();

      const elapsed = () => performance.now() - startedAt;
      const remainingMs = () =>
        Math.max(5_000, TOTAL_TIMEOUT_MS - elapsed());

      if (!shouldSkipGemini35()) {
        try {
          const structuredPrompt = `${buildAllFieldsEnrichPrompt(params.snapshot, params.websiteUrl, {
            structuredOutput: true,
          })}\n\n${userTail}`;

          const structuredResponse = await withTimeout(
            callStructuredSearch(client, structuredPrompt, signal),
            Math.min(STRUCTURED_SEARCH_ATTEMPT_MS, remainingMs()),
            "all_fields_structured_search"
          );
          assertNotAborted();

          const structured = parseAssistantPatch(structuredResponse.text);
          if (structured) {
            logDone(true, "gemini35_structured");
            return structured;
          }
        } catch (structuredErr) {
          if (signal.aborted) throw structuredErr;
          if (!shouldFallbackFromStructuredSearch(structuredErr)) {
            throw structuredErr;
          }
          log(
            "INFO",
            "[businessPartnerFormAssistant] enrichAllFields gemini35 fallback",
            structuredErr instanceof Error
              ? structuredErr.message
              : structuredErr
          );
        }
      }

      const fallbackPrompt = `${buildAllFieldsEnrichPrompt(params.snapshot, params.websiteUrl, {})}\n\n${userTail}`;
      const fallbackResponse = await withTimeout(
        callTextSearchFallback(client, fallbackPrompt, signal),
        remainingMs(),
        "all_fields_web_fallback"
      );
      assertNotAborted();

      const fallback = parseAssistantPatch(fallbackResponse.text);
      if (fallback) {
        logDone(true, "web_fallback");
        return fallback;
      }

      lastError.value =
        "AI の応答を JSON として解釈できませんでした。確認画面で手動編集またはアシスタントをご利用ください。";
      logDone(false, "parse_failed");
      return null;
    } catch (e) {
      if (signal.aborted) {
        log("INFO", "[businessPartnerFormAssistant] enrichAllFieldsFromUrl aborted");
        return null;
      }
      log("ERROR", "[businessPartnerFormAssistant] enrichAllFieldsFromUrl failed", e);
      lastError.value = formatApiError(e);
      logDone(false, "error");
      return null;
    } finally {
      if (pendingAbort?.signal === signal) {
        pendingAbort = null;
      }
      isLoading.value = false;
    }
  };

  const enrichForm = async (params: {
    userMessage: string;
    snapshot: BusinessPartnerFormSnapshot;
    subStep: BusinessPartnerReviewSubStep;
  }): Promise<BusinessPartnerAssistantPatch | null> => {
    cancelPending();
    pendingAbort = new AbortController();
    const { signal } = pendingAbort;

    isLoading.value = true;
    lastError.value = null;

    const route = classifyBusinessPartnerAssistantIntent(
      params.userMessage,
      params.snapshot
    );
    const startedAt = performance.now();

    log("INFO", "[businessPartnerFormAssistant] enrichForm start", {
      route,
      subStep: params.subStep,
      skipGemini35: shouldSkipGemini35(),
      messagePreview: params.userMessage.slice(0, 80),
    });

    const logDone = (ok: boolean, detail?: string) => {
      log("INFO", "[businessPartnerFormAssistant] enrichForm done", {
        route,
        ok,
        durationMs: Math.round(performance.now() - startedAt),
        detail,
      });
    };

    const assertNotAborted = () => {
      if (signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
    };

    try {
      const client = await ensureGeminiClient();
      assertNotAborted();

      const userTail = `## ユーザー指示\n${params.userMessage}`;
      const elapsed = () => performance.now() - startedAt;
      const remainingMs = () =>
        Math.max(5_000, TOTAL_TIMEOUT_MS - elapsed());

      if (route === "local_fill") {
        const structuredPrompt = `${buildSystemPrompt(params.snapshot, params.subStep, {
          route: "local_fill",
          structuredOutput: true,
        })}\n\n${userTail}`;

        const localResponse = await withTimeout(
          callStructuredLocal(client, structuredPrompt, signal),
          Math.min(remainingMs(), TOTAL_TIMEOUT_MS),
          "local_structured"
        );
        assertNotAborted();

        const local = parseAssistantPatch(localResponse.text);
        if (local) {
          logDone(true, "local_fill");
          return local;
        }

        lastError.value =
          "AI の応答を JSON として解釈できませんでした。指示を短くして再試行してください。";
        logDone(false, "local_parse_failed");
        return null;
      }

      // web_search: Gemini 3.5 (短タイムアウト) → 2.5 googleSearch
      if (!shouldSkipGemini35()) {
        try {
          const structuredPrompt = `${buildSystemPrompt(params.snapshot, params.subStep, {
            route: "web_search",
            structuredOutput: true,
          })}\n\n${userTail}`;

          const structuredResponse = await withTimeout(
            callStructuredSearch(client, structuredPrompt, signal),
            Math.min(STRUCTURED_SEARCH_ATTEMPT_MS, remainingMs()),
            "structured_search"
          );
          assertNotAborted();

          const structured = parseAssistantPatch(structuredResponse.text);
          if (structured) {
            logDone(true, "gemini35_structured");
            return structured;
          }

          lastError.value =
            "AI の応答を JSON として解釈できませんでした。指示を短くして再試行してください。";
          logDone(false, "gemini35_parse_failed");
          return null;
        } catch (structuredErr) {
          if (signal.aborted) throw structuredErr;
          if (!shouldFallbackFromStructuredSearch(structuredErr)) {
            throw structuredErr;
          }
          log(
            "INFO",
            "[businessPartnerFormAssistant] gemini35 skip/fallback",
            structuredErr instanceof Error
              ? structuredErr.message
              : structuredErr
          );
        }
      } else {
        log(
          "INFO",
          "[businessPartnerFormAssistant] gemini-3.5 skipped (runtime flag)"
        );
      }

      const fallbackPrompt = `${buildSystemPrompt(params.snapshot, params.subStep, {
        route: "web_search",
      })}\n\n${userTail}`;
      const fallbackResponse = await withTimeout(
        callTextSearchFallback(client, fallbackPrompt, signal),
        remainingMs(),
        "web_search_fallback"
      );
      assertNotAborted();

      const fallback = parseAssistantPatch(fallbackResponse.text);
      if (fallback) {
        logDone(true, "web_fallback");
        return fallback;
      }

      lastError.value =
        "AI の応答を JSON として解釈できませんでした。指示を短くして再試行してください。";
      logDone(false, "web_fallback_parse_failed");
      return null;
    } catch (e) {
      if (signal.aborted) {
        log("INFO", "[businessPartnerFormAssistant] enrichForm aborted");
        return null;
      }
      log("ERROR", "[businessPartnerFormAssistant] enrichForm failed", e);
      lastError.value = formatApiError(e);
      logDone(false, "error");
      return null;
    } finally {
      if (pendingAbort?.signal === signal) {
        pendingAbort = null;
      }
      isLoading.value = false;
    }
  };

  return {
    isLoading,
    lastError,
    enrichForm,
    enrichAllFieldsFromUrl,
    cancelPending,
  };
};
