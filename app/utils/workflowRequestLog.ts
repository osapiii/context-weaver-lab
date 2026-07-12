import {
  REQUEST_LOG_REGISTRY_BY_TYPE,
  type WorkflowRequestLogType,
} from "@utils/requestLogRegistry";
import { getGoogleDriveWorkflowKickerUrl } from "@utils/googleDriveServiceUrl";
import { getWebCrawlWorkflowKickerUrl } from "@utils/webCrawlServiceUrl";
import { useContextStore } from "@stores/context";
import { useOrganizationStore } from "@stores/organization";
import { useSpaceStore } from "@stores/space";
import { driveSyncWorkflowInputGcsPath } from "@utils/knowledgeStoragePaths";

export type { WorkflowRequestLogType };
export {
  WORKFLOW_REQUEST_LOG_TYPES,
  isWorkflowRequestLogType,
} from "@utils/requestLogRegistry";

export type WorkflowInputArtifact = {
  found: boolean;
  bucket: string;
  objectPath: string;
  gsUri: string;
  sizeBytes?: number | null;
  contentType?: string | null;
  updatedAt?: string | null;
  manifest: Record<string, unknown> | null;
};

export function resolveWorkflowInputArtifactUri(params: {
  originalDoc: unknown;
}): string {
  const doc = params.originalDoc as Record<string, unknown> | null | undefined;
  if (!doc) return "";
  const input = doc.input as Record<string, unknown> | undefined;
  const fromInput = String(input?.inputArtifactUri ?? "").trim();
  if (fromInput) return fromInput;
  return String(doc.inputArtifactUri ?? "").trim();
}

export function resolveWorkflowKickerBaseUrl(params: {
  requestType: WorkflowRequestLogType;
}): string {
  switch (params.requestType) {
    case "googleDriveSyncRequest":
      return getGoogleDriveWorkflowKickerUrl();
    case "webCrawlRequest":
      return getWebCrawlWorkflowKickerUrl();
    default:
      return "";
  }
}

export function buildWorkflowRequestDocFirestorePath(params: {
  requestType: WorkflowRequestLogType;
  requestId: string;
}): string {
  const entry = REQUEST_LOG_REGISTRY_BY_TYPE[params.requestType];
  const context = useContextStore();
  const orgId = useOrganizationStore().getLoggedInOrganizationId ?? "";
  const spaceId = useSpaceStore().selectedSpace?.id ?? "";
  const suffix = `${entry.collectionPath}/${params.requestId}`;
  if (entry.scope === "organization") {
    return `organizations/${orgId}/${suffix}`;
  }
  return `organizations/${orgId}/spaces/${spaceId}/${suffix}`;
}

export function extractWebCrawlOutputGcsPrefix(params: {
  originalDoc: unknown;
}): string | null {
  const doc = params.originalDoc as Record<string, unknown> | null | undefined;
  const output = doc?.output as Record<string, unknown> | undefined;
  const prefix = String(output?.gcsPrefix ?? "").trim();
  return prefix || null;
}

export function buildWorkflowStorageExplorerPrefix(params: {
  requestType: WorkflowRequestLogType;
  requestId: string;
  gsUri?: string | null;
  originalDoc?: unknown;
}): string | null {
  if (params.requestType === "webCrawlRequest" && params.originalDoc) {
    const crawlPrefix = extractWebCrawlOutputGcsPrefix({
      originalDoc: params.originalDoc,
    });
    if (crawlPrefix) {
      return crawlPrefix.endsWith("/") ? crawlPrefix : `${crawlPrefix}/`;
    }
  }

  if (params.gsUri?.startsWith("gs://")) {
    const withoutScheme = params.gsUri.slice("gs://".length);
    const slash = withoutScheme.indexOf("/");
    if (slash < 0) return null;
    const objectPath = withoutScheme.slice(slash + 1);
    const folder = objectPath.includes("/")
      ? objectPath.slice(0, objectPath.lastIndexOf("/") + 1)
      : "";
    return folder || null;
  }

  const orgId = useOrganizationStore().getLoggedInOrganizationId ?? "";
  const spaceId = useSpaceStore().selectedSpace?.id ?? "";

  if (params.requestType === "googleDriveSyncRequest" && orgId && spaceId) {
    const objectPath = driveSyncWorkflowInputGcsPath({
      organizationId: orgId,
      spaceId,
      requestId: params.requestId,
    });
    return objectPath.slice(0, objectPath.lastIndexOf("/") + 1);
  }

  return null;
}

export function extractWorkflowConsoleUrl(params: {
  originalDoc: unknown;
}): string {
  const doc = params.originalDoc as Record<string, unknown> | null | undefined;
  const workflow = doc?.workflow as Record<string, unknown> | undefined;
  return String(workflow?.consoleUrl ?? "").trim();
}

export function extractWorkflowStepLogs(
  originalDoc: unknown
): Record<string, unknown> | null {
  const doc = originalDoc as Record<string, unknown> | null | undefined;
  const stepLogs = doc?.stepLogs;
  if (!stepLogs || typeof stepLogs !== "object") return null;
  return stepLogs as Record<string, unknown>;
}
