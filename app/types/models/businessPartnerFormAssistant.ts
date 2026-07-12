import { z } from "zod";

/**
 * 取引先登録フォーム AI アシスタントの structured output.
 * すべてのフィールドは optional — 空欄のみ埋めるマージ方針に合わせる.
 */
export const businessPartnerAssistantPatchZodObject = z.object({
  comment: z
    .string()
    .optional()
    .describe("ユーザー向けの短い説明 (何を補完したか)"),
  fields: z
    .object({
      code: z.string().optional(),
      name: z.string().optional(),
      tradeName: z.string().optional(),
      tradeNameKana: z.string().optional(),
      corporateNumber: z.string().optional(),
      postalCode: z.string().optional(),
      prefecture: z.string().optional(),
      city: z.string().optional(),
      streetAddress: z.string().optional(),
      address: z.string().optional(),
      capitalStock: z.string().optional(),
      representativeName: z.string().optional(),
      representativeTitle: z.string().optional(),
      foundedDate: z.string().optional(),
      industry: z.string().optional(),
      employeeCount: z.string().optional(),
      businessSummary: z.string().optional(),
      contactPerson: z.string().optional(),
      phoneNumber: z.string().optional(),
      email: z.string().optional(),
      website: z.string().optional(),
      note: z.string().optional(),
    })
    .optional(),
});

export type BusinessPartnerAssistantPatch = z.infer<
  typeof businessPartnerAssistantPatchZodObject
>;

export type BusinessPartnerFormSnapshot = {
  code: string;
  name: string;
  corporateNumber: string;
  tradeName: string;
  tradeNameKana: string;
  postalCode: string;
  prefecture: string;
  city: string;
  streetAddress: string;
  address: string;
  capitalStock: string;
  representativeName: string;
  representativeTitle: string;
  foundedDate: string;
  industry: string;
  employeeCount: string;
  businessSummary: string;
  contactPerson: string;
  phoneNumber: string;
  email: string;
  website: string;
  note: string;
};
