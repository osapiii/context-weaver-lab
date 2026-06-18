import { z } from "zod";

// 紐付けテーブルを定義
export const attributeConnectTableZodObject = z
  .object({
    userId: z.string(),
  })
  .catchall(z.string());
