export function normalizeWebPageUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function webPageHostname(url: string): string {
  try {
    return new URL(normalizeWebPageUrl(url)).hostname;
  } catch {
    return "";
  }
}
