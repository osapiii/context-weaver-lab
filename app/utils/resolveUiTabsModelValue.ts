/**
 * Nuxt UI UTabs / USelectMenu 等の v-model が item オブジェクトになる場合に
 * value 文字列へ正規化する。
 */
export function resolveUiTabsModelValue<T extends string>(params: {
  value: unknown;
  valueKey?: string;
  isValid?: (value: string) => value is T;
}): T | undefined {
  const { value, valueKey = "value", isValid } = params;

  if (typeof value === "string") {
    if (!isValid || isValid(value)) {
      return value;
    }
    return undefined;
  }

  if (value != null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const extracted = record[valueKey];
    if (typeof extracted === "string") {
      if (!isValid || isValid(extracted)) {
        return extracted;
      }
    }
  }

  return undefined;
}
