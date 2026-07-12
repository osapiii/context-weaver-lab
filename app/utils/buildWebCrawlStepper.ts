import type { WebCrawlStep } from "@models/webCrawlRequest";
import type { WebCrawlIngestSessionState } from "@utils/webCrawlSession";
import { WEB_CRAWL_IMPORT_USER_LABELS } from "@constants/webCrawlImportUserLabels";
import { isWebCrawlDiscoveringPages } from "@utils/webCrawlPageRows";

export type WebCrawlStepperItem = {
  title: string;
  description?: string;
  icon?: string;
};

const PREP_STEPS = ["loadInput"] as const;
const CRAWL_STEPS = ["crawl"] as const;
const UPLOAD_STEPS = ["uploadToGcs"] as const;
const REGISTER_STEPS = ["registerToFileSpace"] as const;

function countCompleted(
  steps: WebCrawlStep[],
  ids: readonly string[]
): number {
  const set = new Set(ids);
  return steps.filter(
    (s) => set.has(s.id) && (s.status === "completed" || s.status === "skipped")
  ).length;
}

function phaseStatus(
  steps: WebCrawlStep[],
  ids: readonly string[]
): "pending" | "running" | "completed" | "error" {
  const subset = steps.filter((s) => ids.includes(s.id));
  if (subset.some((s) => s.status === "error")) return "error";
  const done = countCompleted(steps, ids);
  if (done >= ids.length) return "completed";
  if (subset.some((s) => s.status === "running")) return "running";
  if (done > 0) return "running";
  return "pending";
}

function statusIcon(
  status: "pending" | "running" | "completed" | "error"
): string {
  switch (status) {
    case "completed":
      return "i-heroicons-check-circle";
    case "running":
      return "i-heroicons-arrow-path";
    case "error":
      return "i-heroicons-x-circle";
    default:
      return "i-heroicons-minus-circle";
  }
}

export function buildWebCrawlStepperItems(
  session: WebCrawlIngestSessionState
): { items: WebCrawlStepperItem[]; activeIndex: number } {
  const steps = session.steps ?? [];
  const prepStatus = phaseStatus(steps, PREP_STEPS);
  const crawlStatus = phaseStatus(steps, CRAWL_STEPS);
  const uploadStatus = phaseStatus(steps, UPLOAD_STEPS);
  const registerStatus = phaseStatus(steps, REGISTER_STEPS);
  const finalizeStep = steps.find((s) => s.id === "finalize");
  const finalizeStatus: "pending" | "running" | "completed" | "error" =
    finalizeStep?.status === "error"
      ? "error"
      : finalizeStep?.status === "completed" ||
          finalizeStep?.status === "skipped"
        ? "completed"
        : finalizeStep?.status === "running"
          ? "running"
          : session.phase === "completed"
            ? "completed"
            : "pending";

  const totalPages = session.progress.totalPages;
  const processedPages = session.progress.processedPages;
  const discovering = isWebCrawlDiscoveringPages(session);

  const items: WebCrawlStepperItem[] = [
    {
      title: WEB_CRAWL_IMPORT_USER_LABELS.stepper.prepare,
      description: `${countCompleted(steps, PREP_STEPS)}/${PREP_STEPS.length} 工程`,
      icon: statusIcon(prepStatus),
    },
    {
      title: WEB_CRAWL_IMPORT_USER_LABELS.stepper.crawl,
      description: discovering
        ? WEB_CRAWL_IMPORT_USER_LABELS.discovering.stepper
        : totalPages > 0
          ? `${processedPages}/${totalPages} ページ`
          : `${countCompleted(steps, CRAWL_STEPS)}/${CRAWL_STEPS.length} 工程`,
      icon: statusIcon(crawlStatus),
    },
    {
      title: WEB_CRAWL_IMPORT_USER_LABELS.stepper.upload,
      description: `${countCompleted(steps, UPLOAD_STEPS)}/${UPLOAD_STEPS.length} 工程`,
      icon: statusIcon(uploadStatus),
    },
    {
      title: WEB_CRAWL_IMPORT_USER_LABELS.stepper.register,
      description:
        finalizeStatus === "completed"
          ? `AI 登録 ${session.output?.filespaceRegisteredCount ?? 0} 件 · 完了`
          : `${countCompleted(steps, REGISTER_STEPS)}/${REGISTER_STEPS.length} 工程 · AI 登録 ${
              session.output?.filespaceRegisteredCount ?? 0
            } 件`,
      icon: statusIcon(
        finalizeStatus === "completed"
          ? "completed"
          : finalizeStatus === "error"
            ? "error"
            : registerStatus
      ),
    },
  ];

  const statuses = [prepStatus, crawlStatus, uploadStatus, registerStatus];
  let activeIndex = statuses.findIndex(
    (s) => s === "running" || s === "pending"
  );
  if (activeIndex < 0) {
    activeIndex = session.phase === "completed" ? 3 : 0;
  }

  return { items, activeIndex };
}
