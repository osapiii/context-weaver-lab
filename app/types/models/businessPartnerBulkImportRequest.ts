import { Timestamp } from "firebase/firestore";
import { z } from "zod";
import { firestoreTypeConverter } from "./firestoreTypeConverter";
import { RequestMetadataSchema } from "./core/operationMetadata";
import { RequestStatusEnum } from "./core/requestStatus";
import {
  businessPartnerLookupSourceEnum,
  businessPartnerTypeEnum,
} from "./businessPartner";

export const businessPartnerBulkImportItemStatusEnum = z.enum([
  "pending",
  "processing",
  "completed",
  "failed",
  "skipped",
]);

export type BusinessPartnerBulkImportItemStatus = z.infer<
  typeof businessPartnerBulkImportItemStatusEnum
>;

/** 1 CSV 行から生成される取引先プレビュー (反映前) */
export const businessPartnerBulkImportPartnerPreviewZodObject = z.object({
  partnerId: z.string(),
  type: businessPartnerTypeEnum,
  code: z.string(),
  name: z.string(),
  website: z.string().optional(),
  imageUrl: z.string().optional(),
  logoUrl: z.string().optional(),
  faviconUrl: z.string().optional(),
  address: z.string().optional(),
  phoneNumber: z.string().optional(),
  email: z.string().optional(),
  contactPerson: z.string().optional(),
  note: z.string().optional(),
  corporateNumber: z.string().optional(),
  tradeName: z.string().optional(),
  tradeNameKana: z.string().optional(),
  postalCode: z.string().optional(),
  prefecture: z.string().optional(),
  city: z.string().optional(),
  streetAddress: z.string().optional(),
  capitalStock: z.string().optional(),
  representativeName: z.string().optional(),
  representativeTitle: z.string().optional(),
  foundedDate: z.string().optional(),
  industry: z.string().optional(),
  employeeCount: z.string().optional(),
  businessSummary: z.string().optional(),
  lookupSource: businessPartnerLookupSourceEnum.optional(),
  lookupAt: z.string().optional(),
  /** 反映済みか (確認画面で commit 後に true) */
  committed: z.boolean().optional(),
});

export type BusinessPartnerBulkImportPartnerPreview = z.infer<
  typeof businessPartnerBulkImportPartnerPreviewZodObject
>;

export const businessPartnerBulkImportItemZodObject = z.object({
  rowIndex: z.number(),
  companyName: z.string(),
  url: z.string(),
  isSupplier: z.boolean(),
  isCustomer: z.boolean(),
  status: businessPartnerBulkImportItemStatusEnum,
  errorMessage: z.string().optional(),
  partners: z.array(businessPartnerBulkImportPartnerPreviewZodObject).default([]),
});

export type BusinessPartnerBulkImportItem = z.infer<
  typeof businessPartnerBulkImportItemZodObject
>;

export const businessPartnerBulkImportRequestZodObject = z.object({
  status: RequestStatusEnum,
  totalCount: z.number(),
  completedCount: z.number().default(0),
  failedCount: z.number().default(0),
  items: z.array(businessPartnerBulkImportItemZodObject).default([]),
  committedAt: z.string().optional(),
  metadata: RequestMetadataSchema.optional(),
});

export const decodedBusinessPartnerBulkImportRequestZodObject =
  businessPartnerBulkImportRequestZodObject.extend({
    id: z.string(),
    createdAt: z.instanceof(Timestamp),
    updatedAt: z.instanceof(Timestamp),
  });

export type DecodedBusinessPartnerBulkImportRequest = z.infer<
  typeof decodedBusinessPartnerBulkImportRequestZodObject
>;

export const businessPartnerBulkImportRequestConverter = firestoreTypeConverter(
  decodedBusinessPartnerBulkImportRequestZodObject
);

export const BUSINESS_PARTNER_BULK_IMPORT_MAX_ROWS = 10;

export const BUSINESS_PARTNER_BULK_IMPORT_REQUESTS_PATH =
  "requests/businessPartnerBulkImportRequests/logs";
