import dayjs from "dayjs";
import log from "@utils/logger";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

// dayjsにUTCとタイムゾーンのプラグインを拡張
dayjs.extend(utc);
dayjs.extend(timezone);

// デフォルトのタイムゾーンを日本時間に設定
dayjs.tz.setDefault("Asia/Tokyo");

/**
 * 日付とIndexを受け取って、date + indexの日付を返す
 * @param {string} date - 日付
 * @param {number} index - インデックス
 * @returns {string} フォーマットされた日付 (YYYY-MM-DD)
 */
export function getDateWithIndexAdd(inputDate: string, index: number): string {
  log("INFO", "getDateWithIndexAdd is called!🔥");
  const date = dayjs(inputDate).add(index, "day").format("YYYY-MM-DD");
  log("INFO", "getDateWithIndexAdd result is...", date);
  return date;
}

/**
 * 今日の日付を取得します。
 * @returns {string} フォーマットされた日付 (YYYY-MM-DD)
 */
export function getToday(): string {
  return dayjs().format("YYYY-MM-DD");
}

/**
 * 現在の日本標準時を取得します。
 * @returns {string} フォーマットされた現在の日本標準時 (YYYY-MM-DD HH:mm:ss)
 */
export function getCurrentJstTime(): string {
  // 現在の日本時刻を取得
  const now = dayjs().tz("Asia/Tokyo");
  return now.format("YYYY-MM-DD HH:mm:ss");
}

/**
 * タイムスタンプを日本標準時にフォーマットします。
 * @param {dayjs.ConfigType} timestamp - フォーマットするタイムスタンプ
 * @returns {string} フォーマットされた日付 (YYYY-MM-DD HH:mm:ss)
 */
export function formatTimestamp(timestamp: dayjs.ConfigType): string {
  const date = dayjs(timestamp).tz("Asia/Tokyo");
  return date.format("YYYY-MM-DD HH:mm:ss");
}

/** チャット吹き出し用の短い時刻表示 (JST). */
export function formatChatMessageTime(timestamp: dayjs.ConfigType): string {
  return dayjs(timestamp).tz("Asia/Tokyo").format("HH:mm");
}

/**
 * 日付文字列をYYYY-MM-DD形式にフォーマットします。
 * @param {string} dateString - フォーマットする日付文字列
 * @returns {string} フォーマットされた日付 (YYYY-MM-DD)
 */
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const year = date.getFullYear();
  // 月と日を2桁にパディング
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

/**
 * 日付から年を除いて月/日の形式で返す
 * @param {string | undefined} dateString - 日付文字列（例: "2025-11-16"）
 * @returns {string} 月/日の形式（例: "11/16"）
 */
export const formatDateWithoutYear = (
  dateString: string | undefined
): string => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day}`;
};

/**
 * 日付文字列をYYYY-MM-DD形式に正規化します。
 * ISO形式、タイムスタンプ形式、既にYYYY-MM-DD形式のいずれでも対応します。
 * @param {string} dateString - 正規化する日付文字列（例: "2025-10-02", "2025-10-02T00:00:00.000Z", "1727827200000"）
 * @returns {string} 正規化された日付 (YYYY-MM-DD形式)
 * @example
 * normalizeDate("2025-10-02") // "2025-10-02"
 * normalizeDate("2025-10-02T00:00:00.000Z") // "2025-10-02"
 * normalizeDate("1727827200000") // "2025-10-02"
 */
export const normalizeDate = (dateString: string): string => {
  try {
    // 既にYYYY-MM-DD形式の場合はそのまま返す
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }
    // ISO形式やタイムスタンプ形式をYYYY-MM-DD形式に変換
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      log("WARN", "Invalid date format:", dateString);
      return dateString;
    }
    const isoString = date.toISOString();
    const datePart = isoString.split("T")[0];
    return datePart || dateString;
  } catch (error) {
    log("ERROR", "Error normalizing date:", dateString, error);
    return dateString;
  }
};

/**
 * UNIXタイムスタンプをYYYY-MM-DD形式にフォーマットします。
 * @param {string} timestamp - フォーマットするUNIXタイムスタンプ
 * @returns {string} フォーマットされた日付 (YYYY-MM-DD)
 */
export const formatUnixTimestamp = (timestamp: string): string => {
  const date = dayjs.unix(Number(timestamp)).tz("Asia/Tokyo");
  return date.format("YYYY-MM-DD");
};

/**
 * フォルダ名から末尾のタイムスタンプを抽出して日時文字列に変換
 *
 * @param {string} name - フォルダ名（例: "video_1759048975128"）
 * @returns {string | null} フォーマットされた日時 (YYYY/MM/DD HH:mm) または null
 *
 * @example
 * extractAndFormatTimestampFromName("video_1759048975128")
 * // => "2025/09/28 12:34"
 *
 * @remarks
 * - 末尾の13桁のミリ秒タイムスタンプを想定
 * - タイムスタンプが見つからない場合はnullを返却
 * - JST（Asia/Tokyo）タイムゾーンでフォーマット
 */
export function extractAndFormatTimestampFromName(name: string): string | null {
  // 末尾の連続する数字を抽出（13桁のミリ秒タイムスタンプを想定）
  const match = name.match(/(\d{13})$/);

  if (!match) return null;

  const timestampMs = parseInt(match[1]);
  const formattedDate = dayjs(timestampMs)
    .tz("Asia/Tokyo")
    .format("YYYY/MM/DD HH:mm");

  return formattedDate;
}

/**
 * 2つの日付間の日数差を計算します。
 * @param {string} baseDate - 基準日 (YYYY-MM-DD形式)
 * @param {string} targetDate - 対象日 (YYYY-MM-DD形式)
 * @returns {number} 日数差（基準日からの日数、負の値の場合は過去）
 */
export function calculateDaysDiff(baseDate: string, targetDate: string): number {
  const base = dayjs(baseDate);
  const target = dayjs(targetDate);
  return target.diff(base, "day");
}

export default {
  getCurrentJstTime,
  formatTimestamp,
  formatDate,
  formatDateWithoutYear,
  getToday,
  extractAndFormatTimestampFromName,
  normalizeDate,
  calculateDaysDiff,
};
