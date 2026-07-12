import { z } from "zod";

// スキーマを定義
export const quillHtmlEditorConfigZodObject = z.object({
  html: z.any(),
  background: z.object({
    color: z.string(),
  }),
});
