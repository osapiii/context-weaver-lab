import {
  DRIVE_TO_GCS_SYNC_SERVICE_URL,
  GOOGLE_DRIVE_WORKFLOW_KICKER_URL,
} from "@constants/googleDriveServices";

/**
 * Drive → GCS Sync microservice (`drive-to-gcs-sync`).
 *
 * FE は `/scan/*` 系 (test-connection / list-folder) のみ直接叩く。
 * 取り込み (`/mirror/*`, `/register/*`) は Workflows 経由で発火する。
 */
export function getDriveToGcsSyncServiceUrl(): string {
  const fromConfig = useRuntimeConfig().public.driveToGcsSyncServiceUrl;
  return (fromConfig || DRIVE_TO_GCS_SYNC_SERVICE_URL).replace(/\/$/, "");
}

/**
 * Google Drive Workflow Kicker microservice. UI からは debug 目的の
 * `/inspect-input` のみ叩く (Workflows input artifact JSON プレビュー).
 */
export function getGoogleDriveWorkflowKickerUrl(): string {
  const fromConfig = useRuntimeConfig().public
    .googleDriveWorkflowKickerServiceUrl;
  return (fromConfig || GOOGLE_DRIVE_WORKFLOW_KICKER_URL).replace(/\/$/, "");
}
