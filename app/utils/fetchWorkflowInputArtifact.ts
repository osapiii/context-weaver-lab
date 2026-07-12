import { fetchDriveSyncInputArtifact } from "@utils/fetchDriveSyncInputArtifact";
import type { WorkflowInputArtifact } from "@utils/workflowRequestLog";
import {
  isWorkflowRequestLogType,
  type WorkflowRequestLogType,
} from "@utils/requestLogRegistry";
import {
  resolveWorkflowInputArtifactUri,
  resolveWorkflowKickerBaseUrl,
} from "@utils/workflowRequestLog";
import type { RequestLog } from "@stores/requestLogHistory";
import { useOrganizationStore } from "@stores/organization";
import { useSpaceStore } from "@stores/space";

export type FetchWorkflowInputArtifactParams = {
  log: Pick<RequestLog, "id" | "requestType" | "originalDoc">;
  kickerBaseUrl?: string;
  fetchImpl?: typeof fetch;
};

async function fetchViaKicker(params: {
  kickerBaseUrl: string;
  gsUri?: string | null;
  requestId?: string | null;
  organizationId?: string | null;
  spaceId?: string | null;
  fetchImpl?: typeof fetch;
}): Promise<WorkflowInputArtifact> {
  const base = params.kickerBaseUrl.replace(/\/$/, "");
  const query = new URLSearchParams();
  if (params.gsUri) query.set("gsUri", params.gsUri);
  if (params.requestId) query.set("requestId", params.requestId);
  if (params.organizationId) query.set("organizationId", params.organizationId);
  if (params.spaceId) query.set("spaceId", params.spaceId);
  const url = `${base}/inspect-input?${query.toString()}`;
  const doFetch = params.fetchImpl ?? fetch;
  const res = await doFetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `inspect-input failed (${res.status}): ${text || res.statusText}`
    );
  }
  return (await res.json()) as WorkflowInputArtifact;
}

/**
 * Workflow RequestDoc に紐づく input artifact (.yml 内 JSON) を kicker 経由で取得する。
 */
export async function fetchWorkflowInputArtifact(
  params: FetchWorkflowInputArtifactParams
): Promise<WorkflowInputArtifact> {
  const { log, kickerBaseUrl, fetchImpl } = params;
  if (!isWorkflowRequestLogType(log.requestType)) {
    throw new Error(
      `fetchWorkflowInputArtifact: unsupported type ${log.requestType}`
    );
  }

  const requestType = log.requestType as WorkflowRequestLogType;
  const gsUri = resolveWorkflowInputArtifactUri({ originalDoc: log.originalDoc });
  const base = kickerBaseUrl ?? resolveWorkflowKickerBaseUrl({ requestType });

  if (requestType === "googleDriveSyncRequest") {
    const organizationId =
      useOrganizationStore().getLoggedInOrganizationId ?? "";
    const spaceId = useSpaceStore().selectedSpace?.id ?? "";
    if (!gsUri && !(log.id && organizationId && spaceId)) {
      throw new Error(
        "fetchWorkflowInputArtifact: gsUri か org/space/requestId が必要です"
      );
    }
    return fetchDriveSyncInputArtifact({
      gsUri,
      requestId: log.id,
      organizationId,
      spaceId,
      kickerBaseUrl: base,
      fetchImpl,
    });
  }

  const organizationId =
    useOrganizationStore().getLoggedInOrganizationId ?? "";

  if (!gsUri && !(log.id && organizationId)) {
    throw new Error(
      "fetchWorkflowInputArtifact: gsUri か organizationId + requestId が必要です"
    );
  }

  return fetchViaKicker({
    kickerBaseUrl: base,
    gsUri,
    requestId: log.id,
    organizationId,
    fetchImpl,
  });
}
