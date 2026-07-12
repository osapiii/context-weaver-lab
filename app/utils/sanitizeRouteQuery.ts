import type { LocationQuery } from "vue-router";

/**
 * router.push / navigateTo の query に渡すため、文字列のみを残す。
 * オブジェクトが混ざると URL に [object Object] が載りルーティングが壊れる。
 */
export function pickStringRouteQuery(
  query: LocationQuery
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, raw] of Object.entries(query)) {
    if (typeof raw === "string") {
      result[key] = raw;
      continue;
    }
    if (Array.isArray(raw)) {
      const first = raw.find((v) => typeof v === "string");
      if (typeof first === "string") {
        result[key] = first;
      }
    }
  }
  return result;
}
