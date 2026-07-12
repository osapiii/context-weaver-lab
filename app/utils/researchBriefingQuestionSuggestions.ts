import { z } from "zod";

export const researchQuestionSuggestionsZodObject = z.object({
  suggestions: z.array(z.string()).max(8),
});

export function parseResearchQuestionSuggestions(params: {
  raw: unknown;
  exclude?: string[];
}): string[] {
  const parsed = researchQuestionSuggestionsZodObject.safeParse(params.raw);
  if (!parsed.success) return [];
  const exclude = new Set(
    (params.exclude ?? []).map((s) => s.trim()).filter(Boolean),
  );
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of parsed.data.suggestions) {
    const text = item.trim();
    if (!text || text.length < 4) continue;
    if (exclude.has(text) || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= 5) break;
  }
  return result;
}

export function buildResearchQuestionSuggestionsPrompt(params: {
  theme: string;
  existingQuestions: string[];
  draftInput: string;
}): string {
  const theme = params.theme.trim() || "(未指定)";
  const existing =
    params.existingQuestions.length > 0
      ? params.existingQuestions.map((q) => `- ${q}`).join("\n")
      : "(まだなし)";
  const partial = params.draftInput.trim();
  const partialLine = partial
    ? `\nユーザーが今タイプ中の文: 「${partial}」\n（この意図に沿った候補を優先）`
    : "";

  return `リサーチテーマに特化した「調べて答えが欲しい問い」の候補を 5 件提案してください。

## テーマ
${theme}

## 既に追加済み
${existing}
${partialLine}

## ルール
- 各候補は 12〜48 文字、具体的で、このテーマにしか当てはまらない内容
- 語尾は「?」推奨
- 既に追加済みと同じ・似すぎる候補は出さない
- 汎用ラベル (例: 「市場動向は?」「メリットは?」だけ) は禁止`;
}
