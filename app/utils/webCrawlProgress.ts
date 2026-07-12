import type { DecodedWebCrawlRequest } from "@models/webCrawlRequest";
import {
  isWebCrawlPipelineActive,
  isWebCrawlTerminal,
} from "@utils/webCrawlTerminal";
import { webCrawlStepUserLabel } from "@constants/webCrawlImportUserLabels";

const STEP_LABELS: Record<string, string> = {
  loadInput: "準備",
  crawl: "ページを読み込み",
  uploadToGcs: "クラウドに保存",
  registerToFileSpace: "AI に登録",
  finalize: "完了処理",
};

const STEP_RANK: Record<string, number> = {
  loadInput: 1,
  crawl: 2,
  uploadToGcs: 3,
  registerToFileSpace: 4,
  finalize: 5,
};

const MAX_STEP_RANK = 5;

export function getWebCrawlStepLabel(step: string | undefined | null): string {
  if (!step) return "準備中";
  return STEP_LABELS[step] ?? webCrawlStepUserLabel(step);
}

export function getWebCrawlStatusPresentation(
  request: DecodedWebCrawlRequest
): {
  label: string;
  badgeColor: "primary" | "success" | "error" | "neutral" | "warning";
  badgeVariant: "soft" | "outline";
} {
  if (request.status === "error") {
    return { label: "失敗", badgeColor: "error", badgeVariant: "soft" };
  }
  if (isWebCrawlTerminal(request)) {
    const failed = request.output?.filespaceRegisterFailed ?? 0;
    if (failed > 0) {
      return {
        label: `完了（${failed}件失敗）`,
        badgeColor: "warning",
        badgeVariant: "soft",
      };
    }
    return { label: "完了", badgeColor: "success", badgeVariant: "soft" };
  }
  if (isWebCrawlPipelineActive(request)) {
    return { label: "実行中", badgeColor: "primary", badgeVariant: "soft" };
  }
  if (request.status === "pending") {
    return { label: "待機", badgeColor: "neutral", badgeVariant: "outline" };
  }
  return { label: request.status, badgeColor: "neutral", badgeVariant: "outline" };
}

export function getWebCrawlProgressPercent(
  request: DecodedWebCrawlRequest
): number {
  if (request.status === "error") return 100;
  if (isWebCrawlTerminal(request)) return 100;
  if (!isWebCrawlPipelineActive(request) && request.status === "pending") {
    return 5;
  }

  const currentStep = request.progress?.currentStep ?? "loadInput";
  const rank = STEP_RANK[currentStep] ?? 1;
  let percent = Math.round((rank / MAX_STEP_RANK) * 100);

  const totalPages = request.progress?.totalPages ?? 0;
  const processedPages = request.progress?.processedPages ?? 0;
  if (totalPages > 0 && currentStep === "crawl") {
    const ratio = Math.min(1, processedPages / totalPages);
    const stageWeight = 100 / MAX_STEP_RANK;
    percent = Math.min(
      99,
      Math.round((rank - 1) * stageWeight + stageWeight * ratio)
    );
  }

  return Math.min(99, Math.max(0, percent));
}
