import { z } from "zod";
import { firestoreTypeConverter } from "./firestoreTypeConverter";
import { Timestamp } from "firebase/firestore";

/**
 * 取引先 (Business Partner)
 *
 * 取引先は以下の 2 種類に分かれる:
 *   - supplier:           仕入先 (子コレクションに 取引実績 を持つ)
 *   - customer: 顧客 (関連データ inventoryPlanEvent から参照される)
 *
 * 法人番号 / 公式 URL を起点に gBizINFO などの公開 API から自動取得した
 * メタデータを保持する。手入力のみでも登録可能 (lookup は補助的役割).
 */
export const businessPartnerTypeEnum = z.union([
  z.literal("supplier"),
  z.literal("customer"),
]);

export type BusinessPartnerType = z.infer<typeof businessPartnerTypeEnum>;

/**
 * 自動取得元 (どの API/ソースで補完したかを記録)
 *   - corporateNumber: 国税庁 / gBizINFO 法人番号 API
 *   - url:             公式サイト URL からのスクレイピング
 *   - manual:          手入力のみ
 */
export const businessPartnerLookupSourceEnum = z.union([
  z.literal("corporateNumber"),
  z.literal("url"),
  z.literal("manual"),
]);

export type BusinessPartnerLookupSource = z.infer<
  typeof businessPartnerLookupSourceEnum
>;

export const businessPartnerZodObject = z.object({
  // ─── 必須フィールド (既存) ──────────────────────────
  code: z.string(),
  name: z.string(),
  type: businessPartnerTypeEnum,

  // ─── 基本連絡先 (既存) ──────────────────────────
  /** 一覧・詳細のアバター表示用 (logoUrl → faviconUrl の優先で設定) */
  imageUrl: z.string().optional(),
  /** og:image / ヘッダーロゴなど */
  logoUrl: z.string().optional(),
  /** link rel=icon 等 */
  faviconUrl: z.string().optional(),
  address: z.string().optional(),
  phoneNumber: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  contactPerson: z.string().optional(),
  note: z.string().optional(),

  // ─── 自動取得で埋まる法人プロファイル ──────────────
  /** 法人番号 (13 桁) - 主キー的役割で重複検出にも使う */
  corporateNumber: z.string().optional(),
  /** 商号 (正式名称) - "株式会社XXX" など */
  tradeName: z.string().optional(),
  /** 屋号 / フリガナ */
  tradeNameKana: z.string().optional(),
  /** 郵便番号 */
  postalCode: z.string().optional(),
  /** 都道府県 */
  prefecture: z.string().optional(),
  /** 市区町村 */
  city: z.string().optional(),
  /** 番地以降 */
  streetAddress: z.string().optional(),
  /** 資本金 (円, 文字列で保持して桁区切り表示しやすく) */
  capitalStock: z.string().optional(),
  /** 代表者氏名 */
  representativeName: z.string().optional(),
  /** 代表者役職 */
  representativeTitle: z.string().optional(),
  /** 設立日 (ISO yyyy-mm-dd) */
  foundedDate: z.string().optional(),
  /** 業種 */
  industry: z.string().optional(),
  /** 従業員数 (文字列, "300人" などのレンジ表現も含む) */
  employeeCount: z.string().optional(),
  /** 事業概要 / 会社概要 (説明文) */
  businessSummary: z.string().optional(),

  // ─── 自動取得メタ情報 ──────────────────────────
  /** どの方法で自動取得したか */
  lookupSource: businessPartnerLookupSourceEnum.optional(),
  /** 最後に自動取得を行った日時 (ISO 文字列) */
  lookupAt: z.string().optional(),
});

export const decodedBusinessPartnerZodObject = businessPartnerZodObject.extend({
  id: z.string(),
  createdAt: z.instanceof(Timestamp),
  updatedAt: z.instanceof(Timestamp),
});

export type DecodedBusinessPartner = z.infer<
  typeof decodedBusinessPartnerZodObject
>;

export const businessPartnerConverter = firestoreTypeConverter(
  decodedBusinessPartnerZodObject
);

/**
 * 自動取得 API のレスポンス (DB に保存する前の構造).
 * 取引先プロファイル系フィールドのみ含み、code / name / type は呼び出し側で設定する.
 */
export type BusinessPartnerLookupResult = {
  corporateNumber?: string;
  name?: string;
  tradeName?: string;
  tradeNameKana?: string;
  postalCode?: string;
  prefecture?: string;
  city?: string;
  streetAddress?: string;
  address?: string;
  phoneNumber?: string;
  email?: string;
  website?: string;
  capitalStock?: string;
  representativeName?: string;
  representativeTitle?: string;
  foundedDate?: string;
  industry?: string;
  employeeCount?: string;
  businessSummary?: string;
  imageUrl?: string;
  logoUrl?: string;
  faviconUrl?: string;
  lookupSource: BusinessPartnerLookupSource;
};
