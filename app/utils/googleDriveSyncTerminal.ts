import type { DecodedGoogleDriveSyncRequest } from "@models/googleDriveSyncRequest";

/**
 * Workflow が finalize ステップを完了したか / 失敗したかで判定する。
 * - status === "completed" or "error" → 終端 (UI は完了/失敗表示に切替)
 * - workflow.state が SUCCEEDED / FAILED / CANCELLED でも終端扱い (workflow が単発で失敗するケース対応)
 */
export function isGoogleDriveSyncTerminal(
  request: DecodedGoogleDriveSyncRequest
): boolean {
  if (request.status === "completed" || request.status === "error") return true;
  const wfState = request.workflow?.state;
  if (wfState === "SUCCEEDED" || wfState === "FAILED" || wfState === "CANCELLED") {
    return true;
  }
  return false;
}

/**
 * パイプラインが進行中か。
 * - workflow.state が SUCCEEDED / FAILED / CANCELLED の場合は status patch が
 *   遅延していてもアクティブ扱いしない (workflow.state を最優先)
 * - workflow.state が ACTIVE もしくは status が pending / processing の場合はアクティブ
 */
export function isGoogleDriveSyncPipelineActive(
  request: DecodedGoogleDriveSyncRequest
): boolean {
  if (isGoogleDriveSyncTerminal(request)) return false;
  if (request.status === "pending" || request.status === "processing") {
    return true;
  }
  if (request.workflow?.state === "ACTIVE") return true;
  return false;
}
