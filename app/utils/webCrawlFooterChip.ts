import type { WebCrawlIngestSessionState } from "@utils/webCrawlSession";
import {
  getWebCrawlProgressPercent,
  getWebCrawlStepLabel,
} from "@utils/webCrawlProgress";
import type { DecodedWebCrawlRequest } from "@models/webCrawlRequest";

export type WebCrawlFooterChipState =
  | "hidden"
  | "running"
  | "completedFlash"
  | "error";

export function resolveWebCrawlFooterChipState(params: {
  session: WebCrawlIngestSessionState;
  completedFlashUntil: number | null;
  activeRequest: DecodedWebCrawlRequest | null;
}): WebCrawlFooterChipState {
  const { session, completedFlashUntil, activeRequest } = params;

  if (session.phase === "running") return "running";
  if (session.phase === "error") return "error";

  if (
    completedFlashUntil != null &&
    completedFlashUntil > Date.now() &&
    session.phase === "completed"
  ) {
    return "completedFlash";
  }

  if (activeRequest && session.phase === "completed") {
    return "hidden";
  }

  return "hidden";
}

export function webCrawlFooterSummary(params: {
  session: WebCrawlIngestSessionState;
  activeRequest: DecodedWebCrawlRequest | null;
  chipState: WebCrawlFooterChipState;
}): { primary: string; secondary: string | null } {
  const { session, activeRequest, chipState } = params;

  if (chipState === "running") {
    const percent = activeRequest
      ? getWebCrawlProgressPercent(activeRequest)
      : 0;
    const step =
      session.progress.currentStep ??
      activeRequest?.progress?.currentStep ??
      "crawl";
    return {
      primary: "Web ページ取り込み中",
      secondary: `${getWebCrawlStepLabel(step)} · ${percent}%`,
    };
  }

  if (chipState === "completedFlash") {
    return {
      primary: "取り込み完了",
      secondary: session.sourceUrl
        ? new URL(session.sourceUrl).hostname
        : null,
    };
  }

  if (chipState === "error") {
    return {
      primary: "取り込み失敗",
      secondary: "詳細を見る",
    };
  }

  return { primary: "", secondary: null };
}
