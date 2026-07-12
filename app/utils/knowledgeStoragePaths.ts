/**
 * Knowledge GCS paths under Firebase Storage.
 *
 * organizations/{orgId}/spaces/{spaceId}/fileSpaces/{fileSpaceId}/knowledges/driveSync/...
 * organizations/{orgId}/spaces/{spaceId}/fileSpaces/{fileSpaceId}/knowledges/manual_upload/...
 * organizations/{orgId}/spaces/{spaceId}/fileSpaces/{fileSpaceId}/knowledges/webCrawl/{sessionFolder}/...
 * organizations/{orgId}/spaces/{spaceId}/knowledges/driveSync/workflowInputs/{requestId}.yml
 */

export const KNOWLEDGES_SEGMENT = "knowledges";
export const DRIVE_SYNC_SEGMENT = "driveSync";
export const MANUAL_UPLOAD_SEGMENT = "manual_upload";
export const WEB_CRAWL_SEGMENT = "webCrawl";
/** @deprecated legacy web crawl layout (pre–knowledge path unification) */
export const LEGACY_WEB_CRAWL_SEGMENT = "web-crawl";
export const WORKFLOW_INPUTS_SEGMENT = "workflowInputs";
export const FILE_SPACES_SEGMENT = "fileSpaces";

/** @deprecated use DRIVE_SYNC_SEGMENT */
export const DRIVE_MIRROR_SEGMENT = DRIVE_SYNC_SEGMENT;

function fileSpaceKnowledgesRelativePrefix(params: {
  fileSpaceId: string;
}): string {
  return `${FILE_SPACES_SEGMENT}/${params.fileSpaceId}/${KNOWLEDGES_SEGMENT}/`;
}

export function driveSyncMirrorListRelativePrefix(params: {
  fileSpaceId: string;
}): string {
  return `${fileSpaceKnowledgesRelativePrefix(params)}${DRIVE_SYNC_SEGMENT}/`;
}

export function driveSyncMirrorListPrefix(params: {
  organizationId: string;
  spaceId: string;
  fileSpaceId: string;
}): string {
  const { organizationId, spaceId, fileSpaceId } = params;
  return `organizations/${organizationId}/spaces/${spaceId}/${driveSyncMirrorListRelativePrefix({ fileSpaceId })}`;
}

export function buildDriveMirrorPrefix(params: {
  bucket: string;
  organizationId: string;
  spaceId: string;
  fileSpaceId: string;
}): string {
  return `gs://${params.bucket}/${driveSyncMirrorListPrefix(params)}`;
}

/** @deprecated alias */
export const driveMirrorListPrefix = driveSyncMirrorListPrefix;

export function manualUploadRelativePath(params: {
  fileSpaceId: string;
  fileName: string;
}): string {
  return `${fileSpaceKnowledgesRelativePrefix({ fileSpaceId: params.fileSpaceId })}${MANUAL_UPLOAD_SEGMENT}/${params.fileName}`;
}

export function manualUploadGcsPath(params: {
  organizationId: string;
  spaceId: string;
  fileSpaceId: string;
  fileName: string;
}): string {
  const { organizationId, spaceId, fileSpaceId, fileName } = params;
  return `organizations/${organizationId}/spaces/${spaceId}/${manualUploadRelativePath({ fileSpaceId, fileName })}`;
}

export function webCrawlListPrefix(params: {
  organizationId: string;
  spaceId: string;
  fileSpaceId: string;
}): string {
  const { organizationId, spaceId, fileSpaceId } = params;
  return `organizations/${organizationId}/spaces/${spaceId}/${fileSpaceKnowledgesRelativePrefix({ fileSpaceId })}${WEB_CRAWL_SEGMENT}/`;
}

export function webCrawlSessionGcsPath(params: {
  organizationId: string;
  spaceId: string;
  fileSpaceId: string;
  sessionFolder: string;
}): string {
  const folder = params.sessionFolder.trim().replace(/^\/+|\/+$/g, "");
  return `${webCrawlListPrefix({
    organizationId: params.organizationId,
    spaceId: params.spaceId,
    fileSpaceId: params.fileSpaceId,
  })}${folder}`;
}

/** Canonical or legacy web-crawl object path under Firebase Storage */
export function isWebCrawlKnowledgeStoragePath(filePath: string): boolean {
  return extractWebCrawlSessionPrefixFromFilePath(filePath) !== null;
}

/** Session folder prefix from a markdown/image object path (canonical or legacy). */
export function extractWebCrawlSessionPrefixFromFilePath(
  filePath: string
): string | null {
  const canonical = filePath.match(
    new RegExp(
      `^(.*\\/${KNOWLEDGES_SEGMENT}\\/${WEB_CRAWL_SEGMENT}\\/[^/]+)`,
      "i"
    )
  );
  if (canonical?.[1]) return canonical[1];
  const legacy = filePath.match(
    new RegExp(
      `^(.*\\/defaultfilespace\\/${LEGACY_WEB_CRAWL_SEGMENT}\\/[^/]+)`,
      "i"
    )
  );
  if (legacy?.[1]) return legacy[1];
  return null;
}

export function driveSyncWorkflowInputGcsPath(params: {
  organizationId: string;
  spaceId: string;
  requestId: string;
}): string {
  const { organizationId, spaceId, requestId } = params;
  return (
    `organizations/${organizationId}/spaces/${spaceId}/` +
    `${KNOWLEDGES_SEGMENT}/${DRIVE_SYNC_SEGMENT}/${WORKFLOW_INPUTS_SEGMENT}/${requestId}.yml`
  );
}

export function gcsBrowserUrlFromGsUri(
  gsUri: string | null | undefined
): string | null {
  if (!gsUri) return null;
  const stripped = gsUri.replace(/^gs:\/\//, "");
  if (!stripped) return null;
  return `https://console.cloud.google.com/storage/browser/${stripped}`;
}
