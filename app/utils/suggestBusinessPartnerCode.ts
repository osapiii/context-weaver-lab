import type { BusinessPartnerType } from "@models/businessPartner";

/** 取引先種別に応じたコード接頭辞 (プレースホルダ SUP- / DST- と一致) */
export const businessPartnerCodePrefix = (
  type: BusinessPartnerType
): "SUP-" | "DST-" =>
  type === "supplier" ? "SUP-" : "DST-";

const LEGAL_ENTITY_PREFIX =
  /^(株式会社|（株）|\(株\)|有限会社|合同会社|合名会社|合資会社|一般社団法人|公益社団法人|学校法人|医療法人|社会福祉法人|特定非営利活動法人|NPO法人)\s*/;

export type SuggestBusinessPartnerCodeInput = {
  type: BusinessPartnerType;
  corporateNumber?: string;
  name?: string;
  tradeName?: string;
  /** 既存取引先コード (重複回避・連番用) */
  existingCodes?: readonly string[];
};

const corporateNumberSuffix = (corporateNumber: string): string | undefined => {
  const digits = corporateNumber.replace(/\D/g, "");
  if (digits.length < 4) return undefined;
  return digits.slice(-4);
};

/**
 * 商号・略称から英数字スラッグを抽出 (例: 株式会社ENOSTECH → ENOSTECH).
 */
export const extractBusinessPartnerNameSlug = (
  text: string
): string | undefined => {
  const stripped = text.replace(LEGAL_ENTITY_PREFIX, "").trim();
  const matches = stripped.match(/[A-Za-z0-9][A-Za-z0-9&.-]*/g);
  if (!matches?.length) return undefined;

  const slug = matches
    .sort((a, b) => b.length - a.length)[0]
    ?.replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();

  if (!slug || slug.length < 2) return undefined;
  return slug.slice(0, 24);
};

const nextSequentialSuffix = (
  prefix: "SUP-" | "DST-",
  existingCodes: readonly string[]
): string => {
  const escaped = prefix.replace("-", "\\-");
  const pattern = new RegExp(`^${escaped}(\\d+)$`);
  const numbers = existingCodes
    .map((code) => {
      const match = code.match(pattern);
      return match ? Number.parseInt(match[1], 10) : 0;
    })
    .filter((n) => Number.isFinite(n) && n > 0);

  const next = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
  return String(next).padStart(3, "0");
};

const ensureUniqueCode = (
  baseCode: string,
  existingCodes: readonly string[]
): string => {
  const taken = new Set(existingCodes.map((c) => c.toUpperCase()));
  if (!taken.has(baseCode.toUpperCase())) return baseCode;

  let seq = 2;
  while (taken.has(`${baseCode}-${seq}`.toUpperCase())) {
    seq += 1;
  }
  return `${baseCode}-${seq}`;
};

/**
 * 取引先コードの提案 (空欄への自動入力用).
 * 優先: 法人番号下4桁 > 商号の英字スラッグ > 種別接頭辞+3桁連番.
 */
export const suggestBusinessPartnerCode = (
  input: SuggestBusinessPartnerCodeInput
): string => {
  const prefix = businessPartnerCodePrefix(input.type);
  const existingCodes = input.existingCodes ?? [];

  const corpSuffix = input.corporateNumber
    ? corporateNumberSuffix(input.corporateNumber.trim())
    : undefined;

  if (corpSuffix) {
    return ensureUniqueCode(`${prefix}${corpSuffix}`, existingCodes);
  }

  const nameSource =
    input.tradeName?.trim() || input.name?.trim() || undefined;
  const nameSlug = nameSource
    ? extractBusinessPartnerNameSlug(nameSource)
    : undefined;

  if (nameSlug) {
    return ensureUniqueCode(`${prefix}${nameSlug}`, existingCodes);
  }

  const sequential = nextSequentialSuffix(prefix, existingCodes);
  return `${prefix}${sequential}`;
};
