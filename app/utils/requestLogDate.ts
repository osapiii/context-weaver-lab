import type { Timestamp } from "firebase/firestore";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 監査表示は JST 基準（formatTimestamp と同じ） */
export function toJstDateKey(date: Date): string {
  const jst = new Date(date.getTime() + JST_OFFSET_MS);
  const year = jst.getUTCFullYear();
  const month = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jst.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseCalendarDateInput(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatCalendarDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function enumerateCalendarDateKeys(
  startYmd: string,
  endYmd: string
): string[] {
  const keys: string[] = [];
  const cursor = parseCalendarDateInput(startYmd);
  const end = parseCalendarDateInput(endYmd);
  while (cursor <= end) {
    keys.push(formatCalendarDateInput(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

export function parseRequestLogDate(
  value: Timestamp | Date | string | null | undefined
): Date | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "string") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "object" && "toDate" in value) {
    const d = (value as Timestamp).toDate();
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function formatTimestamp(timestamp: Timestamp | Date | string): string {
  const date = parseRequestLogDate(timestamp);
  if (!date) return "-";

  const jstDate = new Date(date.getTime() + JST_OFFSET_MS);
  const year = jstDate.getUTCFullYear();
  const month = String(jstDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jstDate.getUTCDate()).padStart(2, "0");
  const hours = String(jstDate.getUTCHours()).padStart(2, "0");
  const minutes = String(jstDate.getUTCMinutes()).padStart(2, "0");
  const seconds = String(jstDate.getUTCSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
