/**
 * Google スプレッドシート連携でユーザーに共有してもらうサービスアカウント。
 * backend/app/triggers/cred/.cred.json の client_email と一致させること。
 * runtimeConfig.public.gsheetServiceAccountEmail があればそちらを優先。
 */
export const DEFAULT_GOOGLE_SHEET_SERVICE_ACCOUNT_EMAIL =
  "en-aistudio-nkm-service-agent@en-aistudio-development.iam.gserviceaccount.com";

export function resolveGoogleSheetServiceAccountEmail(
  runtimePublic?: { gsheetServiceAccountEmail?: string }
): string {
  const fromConfig = runtimePublic?.gsheetServiceAccountEmail?.trim();
  if (fromConfig) return fromConfig;
  return DEFAULT_GOOGLE_SHEET_SERVICE_ACCOUNT_EMAIL;
}

/** URL または生 ID からスプレッドシート ID を抽出 */
export function normalizeSpreadsheetId(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match?.[1]) return match[1];
  if (trimmed.startsWith("http")) return "";
  return trimmed.split("?")[0].split("#")[0];
}
