/** vue-cal 向け日本語ロケール（同期適用用。locale="ja" の async 読込より確実） */
export const JAPANESE_VUE_CAL_LOCALE = {
  weekDays: ["月", "火", "水", "木", "金", "土", "日"],
  weekDaysShort: ["月", "火", "水", "木", "金", "土", "日"],
  months: [
    "1月",
    "2月",
    "3月",
    "4月",
    "5月",
    "6月",
    "7月",
    "8月",
    "9月",
    "10月",
    "11月",
    "12月",
  ],
  years: "年",
  year: "年",
  month: "月",
  week: "週",
  day: "日",
  today: "今日",
  noEvent: "予定なし",
  allDay: "終日",
  deleteEvent: "削除",
  createEvent: "作成",
  dateFormat: "YYYY年 MMMM D日 (dddd)",
} as const;

export type JapaneseWeekdayTone = "weekday" | "saturday" | "sunday";

export function resolveJapaneseWeekdayTone(params: {
  date: Date | string;
}): JapaneseWeekdayTone {
  const date =
    typeof params.date === "string" ? new Date(params.date) : params.date;
  const day = date.getDay();
  if (day === 0) return "sunday";
  if (day === 6) return "saturday";
  return "weekday";
}

/** 曜日見出し（月〜日）の文字色クラス */
export function japaneseWeekdayHeadingClass(label: string): string {
  if (label === "土") return "en-aistudio-vuecal-wd-sat";
  if (label === "日") return "en-aistudio-vuecal-wd-sun";
  return "en-aistudio-vuecal-wd-weekday";
}
