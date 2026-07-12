import type {
  BusinessPartnerLookupResult,
  DecodedBusinessPartner,
} from "@models/businessPartner";

type PartnerBrandImageSource =
  | Pick<
      DecodedBusinessPartner,
      "logoUrl" | "imageUrl" | "faviconUrl" | "website"
    >
  | Pick<
      BusinessPartnerLookupResult,
      "logoUrl" | "imageUrl" | "faviconUrl" | "website"
    >
  | null
  | undefined;

const normalizeUrl = (url?: string | null): string => {
  const trimmed = url?.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const faviconFromWebsite = (website?: string): string => {
  const normalized = normalizeUrl(website);
  if (!normalized) return "";

  try {
    const { origin } = new URL(normalized);
    return `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(origin)}&sz=128`;
  } catch {
    return "";
  }
};

export const resolvePartnerBrandImageUrl = (
  partner: PartnerBrandImageSource
): string => {
  if (!partner) return "";

  const directUrl =
    normalizeUrl(partner.logoUrl) ||
    normalizeUrl(partner.imageUrl) ||
    normalizeUrl(partner.faviconUrl);

  return directUrl || faviconFromWebsite(partner.website);
};
