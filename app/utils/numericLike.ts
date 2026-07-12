/** productMaster 等の numericLike (string | number) を安全に数値化 */
export function toFiniteNumber(value: unknown): number {
  if (value == null || value === "") return 0;
  const n =
    typeof value === "number"
      ? value
      : Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}
