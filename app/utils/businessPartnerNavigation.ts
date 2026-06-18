/**
 * 取引先詳細ページへの URL（別タブ遷移用）
 */
export function buildBusinessPartnerDetailHref(
  partnerId: string,
  organizationId: string
): string {
  const id = String(partnerId ?? "").trim();
  const org = String(organizationId ?? "").trim();
  if (!id) return "/admin/business-partners/list";
  const path = `/admin/business-partners/detail/${encodeURIComponent(id)}`;
  if (!org) return path;
  return `${path}?${new URLSearchParams({ o: org }).toString()}`;
}

export function openBusinessPartnerDetailInNewTab(
  partnerId: string,
  organizationId: string
): void {
  const href = buildBusinessPartnerDetailHref(partnerId, organizationId);
  if (typeof window === "undefined") return;
  window.open(href, "_blank", "noopener,noreferrer");
}
