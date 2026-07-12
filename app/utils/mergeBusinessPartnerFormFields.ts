/**
 * 取引先フォームへの部分マージ (lookup / AI 共通).
 * 既存入力は保持し、空欄のみ上書きする.
 */
export const mergeEmptyFormFields = <T extends Record<string, unknown>>(
  target: T,
  patch: Partial<T> | undefined | null
): void => {
  if (!patch) return;
  for (const key of Object.keys(patch) as Array<keyof T>) {
    const value = patch[key];
    if (value === undefined || value === null) continue;
    const current = target[key];
    if (typeof current === "string" && current.trim().length > 0) continue;
    target[key] = value as T[keyof T];
  }
};
