import { z } from "zod";

// スキーマを定義
export const editorConfigZodObject = z.object({
  html: z.any(),
  design: z.any(),
});
