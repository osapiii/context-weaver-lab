import { BUSINESS_PARTNER_BULK_IMPORT_MAX_ROWS } from "@models/businessPartnerBulkImportRequest";

export type BusinessPartnerBulkCsvRow = {
  rowIndex: number;
  companyName: string;
  url: string;
  isSupplier: boolean;
  isCustomer: boolean;
};

export type FormatCheckMessage = { ok: boolean; text: string };

export type ParseBusinessPartnerBulkCsvResult =
  | {
      ok: true;
      rows: BusinessPartnerBulkCsvRow[];
      formatMessages: FormatCheckMessage[];
    }
  | {
      ok: false;
      rows: BusinessPartnerBulkCsvRow[];
      formatMessages: FormatCheckMessage[];
      rowErrors: Array<{ rowIndex: number; message: string }>;
    };

const HEADER_ALIASES: Record<
  keyof Omit<BusinessPartnerBulkCsvRow, "rowIndex">,
  readonly string[]
> = {
  companyName: [
    "企業名",
    "会社名",
    "取引先名",
    "name",
    "company",
    "companyname",
  ],
  url: ["url", "website", "公式url", "公式サイト", "ホームページ", "hp"],
  isSupplier: [
    "仕入先",
    "仕入先かどうか",
    "仕入先かどうか?",
    "仕入先フラグ",
    "仕入先",
    "仕入先",
    "issupplier",
    "materialsupplier",
    "supplier",
  ],
  isCustomer: [
    "顧客",
    "顧客かどうか",
    "顧客かどうか?",
    "顧客フラグ",
    "顧客",
    "isshippingdestination",
    "shipping",
    "destination",
  ],
};

const normalizeHeader = (raw: string): string =>
  raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[?？]/g, "")
    .replace(/[()（）]/g, "");

const parseBooleanFlag = (raw: string | undefined): boolean | null => {
  if (raw === undefined || raw === null) return null;
  const v = String(raw).trim().toLowerCase();
  if (v === "") return null;
  if (["1", "true", "yes", "y", "はい", "○", "◯", "✓", "on"].includes(v)) {
    return true;
  }
  if (["0", "false", "no", "n", "いいえ", "×", "✗", "off"].includes(v)) {
    return false;
  }
  return null;
};

const isValidUrl = (raw: string): boolean => {
  try {
    const parsed = new URL(raw.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const resolveColumnKey = (
  headers: string[]
): Record<keyof Omit<BusinessPartnerBulkCsvRow, "rowIndex">, number | null> => {
  const normalized = headers.map(normalizeHeader);
  const result: Record<
    keyof Omit<BusinessPartnerBulkCsvRow, "rowIndex">,
    number | null
  > = {
    companyName: null,
    url: null,
    isSupplier: null,
    isCustomer: null,
  };

  for (const [key, aliases] of Object.entries(HEADER_ALIASES) as Array<
    [keyof Omit<BusinessPartnerBulkCsvRow, "rowIndex">, readonly string[]]
  >) {
    for (let i = 0; i < normalized.length; i++) {
      const h = normalized[i];
      if (aliases.some((alias) => normalizeHeader(alias) === h)) {
        result[key] = i;
        break;
      }
    }
  }

  return result;
};

/**
 * PapaParse の header:true 結果 (オブジェクト配列) を検証・正規化する.
 */
export const parseBusinessPartnerBulkCsv = (
  rawRows: Record<string, string>[]
): ParseBusinessPartnerBulkCsvResult => {
  const formatMessages: FormatCheckMessage[] = [];

  if (!rawRows.length) {
    formatMessages.push({ ok: false, text: "CSV にデータ行がありません" });
    return { ok: false, rows: [], formatMessages, rowErrors: [] };
  }

  const headers = Object.keys(rawRows[0] ?? {});
  const columns = resolveColumnKey(headers);

  const missingColumns: string[] = [];
  if (columns.companyName === null) missingColumns.push("企業名");
  if (columns.url === null) missingColumns.push("URL");
  if (columns.isSupplier === null) missingColumns.push("仕入先フラグ");
  if (columns.isCustomer === null) missingColumns.push("顧客フラグ");

  formatMessages.push({
    ok: missingColumns.length === 0,
    text:
      missingColumns.length === 0
        ? "必須列 (企業名 / URL / 仕入先 / 顧客) を検出しました"
        : `必須列が不足しています: ${missingColumns.join("、")}`,
  });

  if (missingColumns.length > 0) {
    return { ok: false, rows: [], formatMessages, rowErrors: [] };
  }

  const dataRows = rawRows.filter((row) =>
    Object.values(row).some((v) => String(v ?? "").trim().length > 0)
  );

  formatMessages.push({
    ok: dataRows.length > 0,
    text:
      dataRows.length > 0
        ? `データ行: ${dataRows.length} 件`
        : "有効なデータ行がありません",
  });

  formatMessages.push({
    ok: dataRows.length <= BUSINESS_PARTNER_BULK_IMPORT_MAX_ROWS,
    text:
      dataRows.length <= BUSINESS_PARTNER_BULK_IMPORT_MAX_ROWS
        ? `登録上限 (${BUSINESS_PARTNER_BULK_IMPORT_MAX_ROWS} 行) 以内です`
        : `一度に登録できるのは ${BUSINESS_PARTNER_BULK_IMPORT_MAX_ROWS} 行までです (現在 ${dataRows.length} 行)`,
  });

  formatMessages.push({
    ok: true,
    text:
      "1 行で仕入・納品の両方が true の場合は、取引先が 2 件生成されます (行数の上限は CSV の行数です)",
  });

  const rowErrors: Array<{ rowIndex: number; message: string }> = [];
  const rows: BusinessPartnerBulkCsvRow[] = [];

  const headerValues = headers;
  const col = columns as Required<typeof columns>;

  dataRows.forEach((row, idx) => {
    const rowIndex = idx + 1;
    const values = headerValues.map((h) => String(row[h] ?? "").trim());
    const companyName = values[col.companyName]?.trim() ?? "";
    const url = values[col.url]?.trim() ?? "";
    const supplierRaw = values[col.isSupplier];
    const shippingRaw = values[col.isCustomer];
    const isSupplier = parseBooleanFlag(supplierRaw);
    const isCustomer = parseBooleanFlag(shippingRaw);

    const issues: string[] = [];
    if (!companyName) issues.push("企業名が空です");
    if (!url) issues.push("URL が空です");
    else if (!isValidUrl(url)) issues.push("URL の形式が不正です");
    if (isSupplier === null) issues.push("仕入先フラグが不正です");
    if (isCustomer === null) issues.push("顧客フラグが不正です");
    if (
      isSupplier === false &&
      isCustomer === false &&
      isSupplier !== null &&
      isCustomer !== null
    ) {
      issues.push("仕入先・顧客のいずれか一方は true にしてください");
    }

    if (issues.length > 0) {
      rowErrors.push({
        rowIndex,
        message: `行 ${rowIndex}: ${issues.join(" / ")}`,
      });
      return;
    }

    rows.push({
      rowIndex,
      companyName,
      url,
      isSupplier: isSupplier!,
      isCustomer: isCustomer!,
    });
  });

  formatMessages.push({
    ok: rowErrors.length === 0,
    text:
      rowErrors.length === 0
        ? "全行の内容チェックに合格しました"
        : `${rowErrors.length} 行にエラーがあります`,
  });

  const ok =
    dataRows.length > 0 &&
    dataRows.length <= BUSINESS_PARTNER_BULK_IMPORT_MAX_ROWS &&
    rowErrors.length === 0;

  if (ok) {
    return { ok: true, rows, formatMessages };
  }
  return { ok: false, rows, formatMessages, rowErrors };
};

/** CSV テンプレート用ヘッダー行 */
export const BUSINESS_PARTNER_BULK_CSV_HEADERS = [
  "企業名",
  "URL",
  "仕入先かどうか?",
  "顧客かどうか?",
] as const;
