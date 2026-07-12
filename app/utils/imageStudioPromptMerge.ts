import type { ImageCreationMode } from "@utils/imageReference";

export type ImageStudioPromptFields = {
  subject: string;
  usage: string;
  creationMode: ImageCreationMode;
};

/** キオスク2項目 → ADK invoke 用プロンプト */
export const buildImageStudioInvokePrompt = (
  params: ImageStudioPromptFields
): string => {
  const subject = params.subject.trim();
  const usage = params.usage.trim();
  if (!subject && !usage) return "";
  if (subject && !usage) return subject;
  if (!subject && usage) {
    return `以下の用途で画像を生成してください。\n\n【用途】${usage}`;
  }

  const lines =
    params.creationMode === "reference"
      ? [
          "お手本画像のレイアウト・構図は維持したまま、以下の内容で画像を生成してください。",
          "",
          `【生成する画像】${subject}`,
          `【用途】${usage}`,
        ]
      : [
          "以下の内容で画像を生成してください。",
          "",
          `【生成する画像】${subject}`,
          `【用途】${usage}`,
        ];

  return lines.join("\n");
};

export const imageStudioPromptFieldsComplete = (params: {
  subject: string;
  usage: string;
}): boolean =>
  params.subject.trim().length > 0 && params.usage.trim().length > 0;
