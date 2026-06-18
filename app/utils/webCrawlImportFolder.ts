import type {
  DecodedWebCrawlRequest,
  WebCrawlImportFolder,
} from "@models/webCrawlRequest";

export function resolveWebCrawlImportFolder(
  request: DecodedWebCrawlRequest
): WebCrawlImportFolder {
  const stored = request.uiMetadata?.importFolder;
  if (stored) return stored;

  let hostname = request.input.url;
  try {
    hostname = new URL(request.input.url).hostname;
  } catch {
    // Keep the URL as a readable fallback for legacy data.
  }

  return {
    id: `webFolder_legacy_${encodeURIComponent(hostname)}`,
    name: hostname,
    description: null,
  };
}
