import type { DecodedWebCrawlRequest } from "@models/webCrawlRequest";

export function isWebCrawlTerminal(request: DecodedWebCrawlRequest): boolean {
  if (request.status === "completed" || request.status === "error") return true;
  const wfState = request.workflow?.state;
  if (
    wfState === "SUCCEEDED" ||
    wfState === "FAILED" ||
    wfState === "CANCELLED"
  ) {
    return true;
  }
  return false;
}

export function isWebCrawlPipelineActive(
  request: DecodedWebCrawlRequest
): boolean {
  if (isWebCrawlTerminal(request)) return false;
  if (request.status === "pending" || request.status === "processing") {
    return true;
  }
  if (request.workflow?.state === "ACTIVE") return true;
  return false;
}

export function isWebCrawlCancelled(
  request: Pick<DecodedWebCrawlRequest, "workflow" | "errorMessage">
): boolean {
  if (request.workflow?.state === "CANCELLED") return true;
  return (request.errorMessage ?? "").includes("キャンセル");
}
