/**
 * Concierge Router — フロント側 Gemini 直叩きで、ユーザーの 1 ターン目入力を
 * どの専門 Agent に渡すか判定する軽量 composable.
 *
 * 役割:
 *   - ハブから `preferred_agent` ヒントが渡された場合は判定スキップ (即返却)
 *   - ヒントが無い「とりあえず話す」エントリの場合のみ Gemini-2.5-flash で分類
 *
 * 戻り値:
 *   { agent: 'writing' | 'sheet' | 'image' | 'consultation' | 'research', reason: string }
 *
 * BYOK: Firestore `users/{uid}/secrets/geminiApiKey` のみ (useGeminiByokStore).
 */
import log from "@utils/logger";

export const CONCIERGE_AGENTS = [
  "writing",
  "sheet",
  "image",
  "consultation",
  "research",
] as const;

export type ConciergeTargetAgent = (typeof CONCIERGE_AGENTS)[number];

export interface ConciergeRoutingResult {
  agent: ConciergeTargetAgent;
  reason: string;
}

const CONCIERGE_SYSTEM_PROMPT = `\
あなたは EN AIstudio の AIスタジオ のコンシェルジュです.
ユーザーの最初の発話を読み、最適な専門 Agent を 1 つだけ選んで JSON で返してください.

## 選択肢
- "writing":      メール / 議事録 / 原稿 / 文章 / コピペで使えるテキスト
- "sheet":        Google Sheets URL を含む / 行追加 / 集計 / 数式
- "image":        画像生成 / アイコン / OGP / Imagen 風依頼
- "consultation": 分析 / 相談 / 壁打ち / データ解釈 (組織ナレッジを参照する深い相談)
- "research":     ディープリサーチ / 白書 / 読み物 / 多 phase 調査 / 「調べて」「リサーチして」

## 出力仕様
JSON 以外を出力しない. Markdown / 前置きも禁止.
スキーマ:
{
  "agent": "writing" | "sheet" | "image" | "consultation" | "research",
  "reason": "20 文字以内の日本語で 1 行"
}

## 判定指針
- Google Sheets URL を含む → sheet
- 「画像」「アイコン」「OGP」など視覚成果物 → image
- 「メール」「議事録」「原稿」「文書」「文章」「コピペで」 → writing
- 「調べて」「リサーチ」「白書」「ディープリサーチ」「徹底的に」 → research
- 「分析」「原因」「相談」「壁打ち」「どう思う」 → consultation
- 迷ったら consultation を選ぶ (一番無難)
`;

const ensureGeminiClient = async () => {
  return useGeminiByokStore().ensureGeminiClient();
};

export const useConciergeRouter = () => {
  /**
   * ユーザーの 1 ターン目発話から target agent を判定する.
   *
   * @param firstMessage 1 ターン目のユーザー入力
   * @param preferredAgent ハブから渡されたヒント (あれば判定スキップ)
   */
  const route = async (
    firstMessage: string,
    preferredAgent?: ConciergeTargetAgent | null
  ): Promise<ConciergeRoutingResult> => {
    if (preferredAgent && CONCIERGE_AGENTS.includes(preferredAgent)) {
      return {
        agent: preferredAgent,
        reason: "ユーザーがジョブを選択済み",
      };
    }

    // 簡易ルール (Gemini を呼ぶ前のショートカット — 明らかなパターン)
    if (/docs\.google\.com\/spreadsheets/.test(firstMessage)) {
      return { agent: "sheet", reason: "Sheets URL を検出" };
    }

    const client = await ensureGeminiClient();
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: `${CONCIERGE_SYSTEM_PROMPT}\n\nユーザー入力:\n${firstMessage}` },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            agent: {
              type: "string",
              enum: [...CONCIERGE_AGENTS],
            },
            reason: { type: "string" },
          },
          required: ["agent", "reason"],
        },
        temperature: 0,
      },
    });

    const raw = response.text;
    if (!raw) {
      log("WARN", "[conciergeRouter] empty response, fallback to consultation");
      return { agent: "consultation", reason: "判定不能のため壁打ちに転送" };
    }

    try {
      const parsed = JSON.parse(raw) as ConciergeRoutingResult;
      if (!CONCIERGE_AGENTS.includes(parsed.agent)) {
        throw new Error(`unknown agent: ${parsed.agent}`);
      }
      return parsed;
    } catch (e) {
      log("WARN", "[conciergeRouter] parse failed", { raw, error: e });
      return { agent: "consultation", reason: "判定不能のため壁打ちに転送" };
    }
  };

  return { route };
};
