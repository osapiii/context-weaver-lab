import type { SavedFile } from "@models/webCrawlRequest";
import type { WebCrawlIngestSessionState } from "@utils/webCrawlSession";
import { WEB_CRAWL_IMPORT_USER_LABELS } from "@constants/webCrawlImportUserLabels";
import {
  driveImportFileColumnCellClass,
  driveImportFileColumnIcon,
  driveImportFileColumnTone,
  type DriveImportFileColumnStatus,
} from "@utils/driveImportFileRows";

export type WebCrawlPageColumnId =
  | "prepare"
  | "crawl"
  | "upload"
  | "register";

export type WebCrawlPageColumnStatus = DriveImportFileColumnStatus;

export type WebCrawlPagePreview = {
  url: string | null;
  title?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImage?: string | null;
  thumbnailGcsPath?: string | null;
  thumbnailBucket?: string | null;
};

export type WebCrawlPageRow = {
  pageId: string;
  label: string;
  url: string | null;
  description?: string | null;
  imageUrl?: string | null;
  thumbnailGcsPath?: string | null;
  thumbnailBucket?: string | null;
  isPlaceholder?: boolean;
  isEntrySeed?: boolean;
  columns: Record<WebCrawlPageColumnId, WebCrawlPageColumnStatus>;
  errorMessage?: string | null;
};

export type WebCrawlPageColumnDef = {
  id: WebCrawlPageColumnId;
  label: string;
};

export const WEB_CRAWL_PAGE_COLUMNS: WebCrawlPageColumnDef[] = [
  { id: "prepare", label: WEB_CRAWL_IMPORT_USER_LABELS.stepper.prepare },
  { id: "crawl", label: WEB_CRAWL_IMPORT_USER_LABELS.stepper.crawl },
  { id: "upload", label: WEB_CRAWL_IMPORT_USER_LABELS.stepper.upload },
  { id: "register", label: WEB_CRAWL_IMPORT_USER_LABELS.stepper.register },
];

const PREP_STEPS = ["loadInput"] as const;
const CRAWL_STEPS = ["crawl"] as const;
const UPLOAD_STEPS = ["uploadToGcs"] as const;
const REGISTER_STEPS = ["registerToFileSpace"] as const;

const DISCOVERY_PLACEHOLDER_COUNT = 3;

const STEP_DETAIL_IDS = [
  "registerToFileSpace",
  "uploadToGcs",
  "crawl",
] as const;

type PhaseStatus = "pending" | "running" | "completed" | "error";

function phaseStatus(
  steps: WebCrawlIngestSessionState["steps"],
  ids: readonly string[]
): PhaseStatus {
  const subset = steps.filter((s) => ids.includes(s.id));
  if (subset.some((s) => s.status === "error")) return "error";
  const done = subset.filter(
    (s) => s.status === "completed" || s.status === "skipped"
  ).length;
  if (done >= ids.length) return "completed";
  if (subset.some((s) => s.status === "running")) return "running";
  if (done > 0) return "running";
  return "pending";
}

function columnFromPhase(
  phase: PhaseStatus,
  opts: { skip?: boolean } = {}
): WebCrawlPageColumnStatus {
  if (opts.skip) return "skipped";
  switch (phase) {
    case "completed":
      return "completed";
    case "running":
      return "running";
    case "error":
      return "error";
    default:
      return "pending";
  }
}

function resolvePageCrawlColumn(
  pageIndex: number,
  processedPages: number,
  crawlPhase: PhaseStatus
): WebCrawlPageColumnStatus {
  if (crawlPhase === "error") return "error";
  if (crawlPhase === "completed") return "completed";
  if (pageIndex < processedPages) return "completed";
  if (pageIndex === processedPages && crawlPhase === "running") return "running";
  return "pending";
}

function resolveLaterColumn(
  earlier: WebCrawlPageColumnStatus,
  phase: PhaseStatus
): WebCrawlPageColumnStatus {
  if (earlier === "error") return "error";
  if (earlier !== "completed") return "pending";
  return columnFromPhase(phase);
}

function pageLabelFromPreview(preview: WebCrawlPagePreview, index: number): string {
  const title =
    preview.ogTitle?.trim() ||
    preview.title?.trim() ||
    "";
  if (title) return title;
  if (preview.url) {
    try {
      return new URL(preview.url).hostname;
    } catch {
      return preview.url;
    }
  }
  return `ページ ${index + 1}`;
}

function pageLabel(file: SavedFile, index: number): string {
  const title = file.title?.trim();
  if (title) return title;
  try {
    return new URL(file.url).hostname;
  } catch {
    return `ページ ${index + 1}`;
  }
}

function shortPageId(id: string): string {
  if (id.length <= 48) return id;
  return `${id.slice(0, 28)}…`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function normalizePreview(raw: unknown): WebCrawlPagePreview | null {
  if (!isRecord(raw)) return null;
  const url = typeof raw.url === "string" ? raw.url : null;
  if (!url) return null;
  return {
    url,
    title: typeof raw.title === "string" ? raw.title : null,
    ogTitle: typeof raw.ogTitle === "string" ? raw.ogTitle : null,
    ogDescription:
      typeof raw.ogDescription === "string" ? raw.ogDescription : null,
    ogImage: typeof raw.ogImage === "string" ? raw.ogImage : null,
    thumbnailGcsPath:
      typeof raw.thumbnailGcsPath === "string" ? raw.thumbnailGcsPath : null,
    thumbnailBucket:
      typeof raw.thumbnailBucket === "string" ? raw.thumbnailBucket : null,
  };
}

function resolveSessionGcsBucket(
  session: WebCrawlIngestSessionState
): string | null {
  const fromOutput = session.output?.gcsBucketName;
  if (typeof fromOutput === "string" && fromOutput.trim()) return fromOutput;

  for (const stepId of STEP_DETAIL_IDS) {
    const detail = session.steps.find((s) => s.id === stepId)?.detail;
    if (!isRecord(detail)) continue;
    const bucket = detail.gcsBucketName;
    if (typeof bucket === "string" && bucket.trim()) return bucket;
  }
  return null;
}

function previewsFromDetail(
  detail: Record<string, unknown> | null | undefined
): WebCrawlPagePreview[] {
  if (!detail) return [];
  const pagesRaw = detail.pages;
  if (Array.isArray(pagesRaw)) {
    return pagesRaw
      .map(normalizePreview)
      .filter((p): p is WebCrawlPagePreview => p != null);
  }
  const savedRaw = detail.savedFiles;
  if (Array.isArray(savedRaw)) {
    return savedRaw
      .map((file, index) => {
        if (!isRecord(file)) return null;
        const url = typeof file.url === "string" ? file.url : null;
        if (!url) return null;
        return {
          url,
          title: typeof file.title === "string" ? file.title : null,
        } satisfies WebCrawlPagePreview;
      })
      .filter((p): p is WebCrawlPagePreview => p != null);
  }
  return [];
}

function resolveImageUrl(preview: WebCrawlPagePreview): string | null {
  const og = preview.ogImage?.trim();
  if (og && /^https?:\/\//i.test(og)) return og;
  return null;
}

function extractPagePreviews(
  session: WebCrawlIngestSessionState
): WebCrawlPagePreview[] {
  const savedFiles = session.output?.savedFiles ?? [];
  if (savedFiles.length > 0) {
    return savedFiles.map((file) => ({
      url: file.url,
      title: file.title,
    }));
  }

  for (const stepId of STEP_DETAIL_IDS) {
    const step = session.steps.find((s) => s.id === stepId);
    const fromDetail = previewsFromDetail(
      step?.detail as Record<string, unknown> | null | undefined
    );
    if (fromDetail.length > 0) return fromDetail;
  }

  return [];
}

type PageSource = {
  pageId: string;
  label: string;
  url: string | null;
  description?: string | null;
  imageUrl?: string | null;
  thumbnailGcsPath?: string | null;
  thumbnailBucket?: string | null;
  isPlaceholder?: boolean;
  isEntrySeed?: boolean;
};

function crawlStepIsRunning(session: WebCrawlIngestSessionState): boolean {
  return session.steps.some((s) => s.id === "crawl" && s.status === "running");
}

/** 確定したページ一覧がまだ無いフェーズ（準備〜探索） */
export function isWebCrawlAwaitingPageList(
  session: WebCrawlIngestSessionState
): boolean {
  if (extractPagePreviews(session).length > 0) return false;
  if (session.phase === "completed" || session.phase === "error") return false;
  return (session.progress.totalPages ?? 0) === 0;
}

/** crawl 実行中で、まだページ一覧が確定していない探索フェーズ */
export function isWebCrawlDiscoveringPages(
  session: WebCrawlIngestSessionState
): boolean {
  return isWebCrawlAwaitingPageList(session) && crawlStepIsRunning(session);
}

export function isWebCrawlPreparingPages(
  session: WebCrawlIngestSessionState
): boolean {
  return isWebCrawlAwaitingPageList(session) && !crawlStepIsRunning(session);
}

function buildDiscoveryPageSources(
  session: WebCrawlIngestSessionState
): PageSource[] {
  const url = session.sourceUrl;
  const entry: PageSource = {
    pageId: url ?? "entry-seed",
    label: WEB_CRAWL_IMPORT_USER_LABELS.discovering.entryLabel,
    url,
    description: WEB_CRAWL_IMPORT_USER_LABELS.discovering.entryHint,
    isEntrySeed: true,
  };
  const placeholders = Array.from(
    { length: DISCOVERY_PLACEHOLDER_COUNT },
    (_, index) => ({
      pageId: `discovering-placeholder-${index}`,
      label: WEB_CRAWL_IMPORT_USER_LABELS.discovering.placeholder,
      url: null,
      isPlaceholder: true,
    })
  );
  return [entry, ...placeholders];
}

function buildPageSources(session: WebCrawlIngestSessionState): PageSource[] {
  if (isWebCrawlAwaitingPageList(session)) {
    return buildDiscoveryPageSources(session);
  }

  const previews = extractPagePreviews(session);
  const defaultBucket = resolveSessionGcsBucket(session);
  if (previews.length > 0) {
    return previews.map((preview, index) => ({
      pageId: preview.url || `page-${index}`,
      label: pageLabelFromPreview(preview, index),
      url: preview.url,
      description: preview.ogDescription?.trim() || null,
      imageUrl: resolveImageUrl(preview),
      thumbnailGcsPath: preview.thumbnailGcsPath ?? null,
      thumbnailBucket:
        preview.thumbnailBucket ??
        (preview.thumbnailGcsPath ? defaultBucket : null),
    }));
  }

  const totalPages = session.progress.totalPages;
  const processedPages = session.progress.processedPages;
  const count = Math.max(totalPages, processedPages, 0);

  if (count > 0) {
    return Array.from({ length: count }, (_, index) => ({
      pageId: `pending-page-${index}`,
      label:
        count === 1
          ? "ページを読み込み中…"
          : `ページ ${index + 1}`,
      url: index === 0 ? session.sourceUrl : null,
    }));
  }

  return [];
}

/**
 * RequestDoc スナップショットから 1 行 = 1 ページ URL の進捗行を組み立てる。
 */
export function buildWebCrawlPageRows(params: {
  session: WebCrawlIngestSessionState;
}): WebCrawlPageRow[] {
  const { session } = params;
  const steps = session.steps ?? [];
  const prep = phaseStatus(steps, PREP_STEPS);
  const crawlPhase = phaseStatus(steps, CRAWL_STEPS);
  const uploadPhase = phaseStatus(steps, UPLOAD_STEPS);
  const registerPhase = phaseStatus(steps, REGISTER_STEPS);
  const finalizeStep = steps.find((s) => s.id === "finalize");
  const completePhase: PhaseStatus =
    finalizeStep?.status === "error"
      ? "error"
      : finalizeStep?.status === "completed" ||
          finalizeStep?.status === "skipped" ||
          session.phase === "completed"
        ? "completed"
        : finalizeStep?.status === "running"
          ? "running"
          : registerPhase === "completed"
            ? "running"
            : "pending";

  const processedPages = session.progress.processedPages ?? 0;
  const errorMessage =
    session.phase === "error" ? session.errorMessage ?? null : null;

  return buildPageSources(session).map((source, index) => {
    let crawlCol = source.isPlaceholder
      ? "pending"
      : resolvePageCrawlColumn(index, processedPages, crawlPhase);
    if (source.isEntrySeed && crawlPhase === "running") {
      crawlCol = "running";
    }
    const uploadCol = source.isPlaceholder
      ? "pending"
      : resolveLaterColumn(crawlCol, uploadPhase);
    const registerCol = source.isPlaceholder
      ? "pending"
      : errorMessage && session.phase === "error"
        ? "error"
        : resolveLaterColumn(
            uploadCol,
            registerPhase === "completed" ? completePhase : registerPhase
          );

    return {
      pageId: source.pageId,
      label: source.label,
      url: source.url,
      description: source.description,
      imageUrl: source.imageUrl,
      thumbnailGcsPath: source.thumbnailGcsPath,
      thumbnailBucket: source.thumbnailBucket,
      isPlaceholder: source.isPlaceholder,
      isEntrySeed: source.isEntrySeed,
      columns: {
        prepare: columnFromPhase(prep),
        crawl: crawlCol,
        upload: uploadCol,
        register: registerCol,
      },
      errorMessage: index === 0 ? errorMessage : null,
    };
  });
}

export function webCrawlPageColumnIcon(
  status: WebCrawlPageColumnStatus
): string {
  return driveImportFileColumnIcon(status);
}

export function webCrawlPageColumnTone(
  status: WebCrawlPageColumnStatus
): string {
  return driveImportFileColumnTone(status);
}

export function webCrawlPageColumnCellClass(
  status: WebCrawlPageColumnStatus
): string {
  return driveImportFileColumnCellClass(status);
}

export function shortWebCrawlPageId(id: string): string {
  return shortPageId(id);
}

/** 進捗テーブル表示用。OG 説明文を末尾省略（行高のチラつき防止） */
export function truncateWebCrawlPageDescription(
  text: string,
  maxLength = 48
): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  const ellipsis = "…";
  return `${trimmed.slice(0, maxLength - ellipsis.length)}${ellipsis}`;
}

/** 進捗テーブル表示用。長い URL を中央省略してステップ列の幅を確保する */
export function truncateWebCrawlDisplayUrl(
  text: string,
  maxLength = 52
): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  const ellipsis = "…";
  const keep = maxLength - ellipsis.length;
  const head = Math.ceil(keep * 0.55);
  const tail = keep - head;
  return `${trimmed.slice(0, head)}${ellipsis}${trimmed.slice(-tail)}`;
}

export function webCrawlPageRowIsActive(row: WebCrawlPageRow): boolean {
  return Object.values(row.columns).some((s) => s === "running");
}

export function computeWebCrawlPageProgressPercent(
  rows: WebCrawlPageRow[]
): number {
  if (rows.length === 0) return 0;
  const columnIds = WEB_CRAWL_PAGE_COLUMNS.map((c) => c.id);
  let done = 0;
  const total = rows.length * columnIds.length;
  for (const row of rows) {
    for (const id of columnIds) {
      const status = row.columns[id];
      if (
        status === "completed" ||
        status === "skipped" ||
        status === "error"
      ) {
        done += 1;
      } else if (status === "running") {
        done += 0.5;
      }
    }
  }
  return Math.min(100, Math.round((done / total) * 100));
}
