import { toRaw } from "vue";

/**
 * シミュレーション計算ログ用のディープコピー.
 * Pinia の reactive や Window 参照を含むと structuredClone が失敗するため toRaw + JSON フォールバックを使う.
 */
export function cloneCalculationSnapshot<T>(value: T): T {
  const raw = (value != null && typeof value === "object"
    ? toRaw(value as object)
    : value) as T;

  try {
    return structuredClone(raw);
  } catch {
    return JSON.parse(JSON.stringify(raw)) as T;
  }
}
