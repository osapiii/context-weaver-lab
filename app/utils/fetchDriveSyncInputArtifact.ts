/**
 * Fetch Workflows input artifact (GCS YAML) for a Drive Sync RequestDoc.
 *
 * The artifact is the JSON manifest the kicker uploaded to
 * organizations/{orgId}/spaces/{spaceId}/knowledges/driveSync/workflowInputs/{requestId}.yml
 * the Workflow execution. UI calls the kicker microservice's `/inspect-input`
 * endpoint to retrieve it for debug visibility (verify what was actually
 * passed into the Workflow).
 */

import { getGoogleDriveWorkflowKickerUrl } from "@utils/googleDriveServiceUrl";

export type DriveSyncInputArtifact = {
  found: boolean;
  bucket: string;
  objectPath: string;
  gsUri: string;
  sizeBytes?: number | null;
  contentType?: string | null;
  updatedAt?: string | null;
  /** Parsed JSON manifest. `null` when `found=false`. */
  manifest: Record<string, unknown> | null;
};

export type FetchDriveSyncInputArtifactParams = {
  /** Preferred: full `gs://...` URI from `RequestDoc.input.inputArtifactUri`. */
  gsUri?: string | null;
  /** Fallback when gsUri is missing (mostly for compat). */
  requestId?: string | null;
  organizationId?: string | null;
  spaceId?: string | null;
  /** Optional override of the kicker base URL (test seam). */
  kickerBaseUrl?: string;
  /** Optional fetch override (test seam). */
  fetchImpl?: typeof fetch;
};

/**
 * Calls `GET {kicker}/inspect-input?gsUri=...` (or requestId+organizationId+spaceId).
 *
 * Throws if neither identifier is provided, or if the HTTP call fails.
 */
export async function fetchDriveSyncInputArtifact(
  params: FetchDriveSyncInputArtifactParams
): Promise<DriveSyncInputArtifact> {
  const { gsUri, requestId, organizationId, spaceId, kickerBaseUrl, fetchImpl } =
    params;
  if (!gsUri && !(requestId && organizationId && spaceId)) {
    throw new Error(
      "fetchDriveSyncInputArtifact: gsUri か (requestId + organizationId + spaceId) のいずれかが必要です"
    );
  }

  const base = (kickerBaseUrl ?? getGoogleDriveWorkflowKickerUrl()).replace(
    /\/$/,
    ""
  );
  const query = new URLSearchParams();
  if (gsUri) query.set("gsUri", gsUri);
  if (requestId) query.set("requestId", requestId);
  if (organizationId) query.set("organizationId", organizationId);
  if (spaceId) query.set("spaceId", spaceId);
  const url = `${base}/inspect-input?${query.toString()}`;

  const doFetch = fetchImpl ?? fetch;
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
  const json = (await res.json()) as DriveSyncInputArtifact;
  return json;
}
