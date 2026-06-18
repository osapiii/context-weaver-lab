/**
 * 金額をカンマ区切りでフォーマットする
 * @param amount フォーマットする金額
 * @returns フォーマットされた金額文字列（例: ¥1,234,567）
 */
export const formatCurrency = (amount: number): string => {
  return `¥${amount.toLocaleString("ja-JP")}`;
};

/** UI 表示用: 有限数値かどうか */
export const isDisplayableNumber = (
  value: unknown
): value is number => typeof value === "number" && Number.isFinite(value);

/**
 * UI 表示用の金額（NaN / Infinity / null はプレースホルダ）
 */
export const formatDisplayCurrency = (params: {
  amount: number | null | undefined;
  fallback?: string;
}): string => {
  const { amount, fallback = "—" } = params;
  if (!isDisplayableNumber(amount)) return fallback;
  return formatCurrency(Math.round(amount));
};

/**
 * パーセンテージをフォーマットする
 * @param value フォーマットする値
 * @param decimals 小数点以下の桁数
 * @returns フォーマットされたパーセンテージ文字列（例: 12.3%）
 */
export const formatPercentage = (
  value: number,
  decimals: number = 1
): string => {
  return `${value.toFixed(decimals)}%`;
};

/** UI 表示用のパーセンテージ */
export const formatDisplayPercentage = (params: {
  value: number | null | undefined;
  decimals?: number;
  fallback?: string;
}): string => {
  const { value, decimals = 1, fallback = "—" } = params;
  if (!isDisplayableNumber(value)) return fallback;
  return formatPercentage(value, decimals);
};

/**
 * 数値をカンマ区切りでフォーマットする
 * @param value フォーマットする数値
 * @param decimals 小数点以下の桁数（デフォルト: 0 = 整数）
 * @returns フォーマットされた数値文字列（例: 1,234,567）
 */
export const formatNumber = (
  value: number,
  decimals: number = 0
): string => {
  return value.toLocaleString("ja-JP", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

/** UI 表示用の数値 */
export const formatDisplayNumber = (params: {
  value: number | null | undefined;
  decimals?: number;
  fallback?: string;
  suffix?: string;
}): string => {
  const { value, decimals = 0, fallback = "—", suffix = "" } = params;
  if (!isDisplayableNumber(value)) return fallback;
  return `${formatNumber(value, decimals)}${suffix}`;
};
