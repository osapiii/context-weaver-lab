import dayjs from "dayjs";

/**
 * vue-cal の cell-click / update:selected-date が渡す値を YYYY-MM-DD に正規化する。
 * - cell-click: Date または { date: Date, split? }
 * - selected-date: Date | string
 */
export function normalizeVueCalDateInput(value: unknown): string | null {
  if (value == null) return null;

  let raw: unknown = value;
  if (typeof value === "object" && value !== null && "date" in value) {
    raw = (value as { date: unknown }).date;
  }

  if (raw instanceof Date) {
    const d = dayjs(raw);
    return d.isValid() ? d.format("YYYY-MM-DD") : null;
  }

  if (typeof raw === "string") {
    const d = dayjs(raw);
    return d.isValid() ? d.format("YYYY-MM-DD") : null;
  }

  if (
    typeof raw === "object" &&
    raw !== null &&
    "format" in raw &&
    typeof (raw as { format: unknown }).format === "function"
  ) {
    const formatted = (raw as { format: (pattern?: string) => string }).format(
      "YYYY-MM-DD"
    );
    const d = dayjs(formatted);
    return d.isValid() ? d.format("YYYY-MM-DD") : null;
  }

  return null;
}
