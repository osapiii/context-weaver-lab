/**
 * 組織名から組織コード候補を生成する (Godモード UI 用)。
 * 英数字以外は除去し、先頭32文字に切り詰める。
 */
export function suggestOrganizationCode(organizationName: string): string {
  const normalized = organizationName
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);

  return normalized || "NEW_ORG";
}
