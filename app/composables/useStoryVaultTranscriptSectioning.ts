import { z } from "zod";
import type { StoryVaultTranscriptCue } from "@models/storyVault";
import { zodToJsonSchema } from "@utils/zod-to-json-schema";
import {
  buildFallbackStoryVaultSections,
  normalizeStoryVaultAiSections,
  type StoryVaultClipSectionDraft,
} from "@utils/storyVaultClipSectioning";
import { reportDatadogError } from "@utils/datadogObservability";

const sectioningResponseSchema = z.object({
  sections: z.array(
    z.object({
      endCueId: z.string(),
      title: z.string(),
      summary: z.string(),
    })
  ),
});

const responseSchema = zodToJsonSchema(sectioningResponseSchema);

export function useStoryVaultTranscriptSectioning() {
  const generateSections = async (params: {
    cues: StoryVaultTranscriptCue[];
    durationMs: number;
  }): Promise<StoryVaultClipSectionDraft[]> => {
    const fallback = buildFallbackStoryVaultSections(params.cues, params.durationMs);
    if (params.durationMs <= 90_000 || params.cues.length === 0) return fallback;

    try {
      const [{ getApp }, { getAI, getGenerativeModel, GoogleAIBackend }] =
        await Promise.all([import("firebase/app"), import("firebase/ai")]);
      const ai = getAI(getApp(), { backend: new GoogleAIBackend() });
      const model = getGenerativeModel(ai, {
        model: "gemini-2.5-flash-lite",
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
          responseSchema,
        },
      });
      const cueText = params.cues
        .map(
          (cue) =>
            `${cue.id} | ${Math.round(cue.startMs / 1000)}-${Math.round(cue.endMs / 1000)}秒 | ${cue.text.replace(/\s+/g, " ").trim().slice(0, 180)}`
        )
        .join("\n");
      const result = await model.generateContent([
        [
          "StoryVaultへ取り込む長尺のプロダクト説明動画を、意味のまとまりごとに分割してください。",
          "各クリップは約60秒を目安とし、原則35秒以上90秒以内にしてください。",
          "機能、画面、操作目的、話題が切り替わる発話の終端を境界にしてください。",
          "各区間の終端は必ず下記に存在するcue IDのendCueIdで指定してください。最後の区間は必ず最終cueのIDを指定し、全区間を順番に出力してください。",
          "各区間には、動画クリップ一覧で内容が一目で分かる短い日本語タイトルと要約を付けてください。",
          "短い動画を無理に分割せず、同じ話題を細切れにしないでください。",
          "",
          `動画時間: ${Math.round(params.durationMs / 1000)}秒`,
          "",
          "## タイムスタンプ付き文字起こし",
          cueText,
        ].join("\n"),
      ]);
      const parsed = sectioningResponseSchema.parse(
        JSON.parse(result.response.text() || "{}")
      );
      const normalized = normalizeStoryVaultAiSections(
        parsed.sections,
        params.cues,
        params.durationMs
      );
      return normalized.length > 0 ? normalized : fallback;
    } catch (error) {
      reportDatadogError(error, {
        feature: "storyvault_transcript_auto_sectioning",
        cueCount: params.cues.length,
        durationMs: params.durationMs,
      });
      return fallback;
    }
  };

  return { generateSections };
}
