import type {
  DecodedStoryVaultApplication,
  StoryVaultOperationVideoDisplaySurface,
} from "@models/storyVault";

type OperationVideoDocumentParams = {
  application: Pick<
    DecodedStoryVaultApplication,
    "id" | "applicationKey" | "name" | "repoFullName" | "startUrl"
  >;
  videoId: string;
  title: string;
  description?: string;
  bucketName: string;
  storagePath: string;
  contentType: string;
  sizeBytes: number;
  durationMs?: number;
  recordedAt: string;
  sourceDisplaySurface?: StoryVaultOperationVideoDisplaySurface;
  tags?: string[];
  transcriptText?: string;
  transcriptProvider?: string;
  transcriptSummary?: string;
  transcriptSrt?: string;
  transcriptSegments?: Array<{
    id: string;
    index: number;
    startMs: number;
    endMs: number;
    text: string;
  }>;
  transcriptTimingStatus?: string;
  quickScan?: {
    title?: string;
    description?: string;
    operationMemo?: string;
    operationSteps?: string[];
    transcriptSummary?: string;
  };
  frameCaptures?: Array<{
    id: string;
    timestampMs: number;
    fileName?: string;
    storagePath?: string;
    width?: number;
    height?: number;
  }>;
};

const durationSeconds = (durationMs?: number): number | null =>
  typeof durationMs === "number" ? Math.round(durationMs / 1000) : null;

const nonEmptyLines = (lines: Array<string | false | null | undefined>): string[] =>
  lines.filter((line): line is string => typeof line === "string" && line !== "");

const numberedLines = (items?: string[]): string[] =>
  (items ?? [])
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item, index) => `${index + 1}. ${item}`);

const frameLines = (frames?: OperationVideoDocumentParams["frameCaptures"]): string[] =>
  (frames ?? []).map((frame, index) => {
    const seconds = Math.round(Math.max(0, frame.timestampMs) / 1000);
    const size = frame.width && frame.height ? ` / ${frame.width}x${frame.height}` : "";
    const path = frame.storagePath ? ` / ${frame.storagePath}` : "";
    return `- ${index + 1}. ${seconds}s / ${frame.id}${size}${path}`;
  });

export const buildOperationVideoMetadataMarkdown = (
  params: OperationVideoDocumentParams
): string => {
  const seconds = durationSeconds(params.durationMs);
  return nonEmptyLines([
    `# ${params.title}`,
    "",
    params.description?.trim() || "ザッピング動画のメタデータです。",
    "",
    "## Application",
    `- Name: ${params.application.name}`,
    `- Application ID: ${params.application.id}`,
    `- Application Key: ${params.application.applicationKey}`,
    `- Repository: ${params.application.repoFullName}`,
    params.application.startUrl ? `- Start URL: ${params.application.startUrl}` : "",
    "",
    "## Recording",
    `- Video ID: ${params.videoId}`,
    `- Recorded At: ${params.recordedAt}`,
    `- Display Surface: ${params.sourceDisplaySurface ?? "unknown"}`,
    seconds !== null ? `- Duration: ${seconds} seconds` : "",
    `- Content Type: ${params.contentType}`,
    `- Size Bytes: ${params.sizeBytes}`,
    params.tags?.length ? `- Tags: ${params.tags.join(", ")}` : "",
    params.transcriptProvider
      ? `- Transcript Provider: ${params.transcriptProvider}`
      : "",
    "",
    params.quickScan?.title?.trim() ? "## AI Pre Analysis" : "",
    params.quickScan?.title?.trim() ? `- Title: ${params.quickScan.title.trim()}` : "",
    params.quickScan?.description?.trim()
      ? `- Description: ${params.quickScan.description.trim()}`
      : "",
    params.quickScan?.operationSteps?.length ? "" : "",
    params.quickScan?.operationSteps?.length ? "## Operation Steps" : "",
    ...numberedLines(params.quickScan?.operationSteps),
    params.quickScan?.operationMemo?.trim() ? "" : "",
    params.quickScan?.operationMemo?.trim() ? "## Operation Memo" : "",
    params.quickScan?.operationMemo?.trim() || "",
    params.frameCaptures?.length ? "" : "",
    params.frameCaptures?.length ? "## Frame Captures" : "",
    ...frameLines(params.frameCaptures),
    params.frameCaptures?.length ? "" : "",
    params.transcriptSummary?.trim() ? "## Transcript Summary" : "",
    params.transcriptSummary?.trim() || "",
    params.transcriptSummary?.trim() ? "" : "",
    params.transcriptSrt?.trim() ? "## Timestamped Transcript (SRT)" : "",
    params.transcriptSrt?.trim() || "",
    params.transcriptSrt?.trim() ? "" : "",
    params.transcriptText?.trim() ? "## Transcript" : "",
    params.transcriptText?.trim() || "",
    params.transcriptText?.trim() ? "" : "",
    "## Storage",
    `- Bucket: ${params.bucketName}`,
    `- Path: ${params.storagePath}`,
  ]).join("\n");
};

export const buildOperationVideoJourneyMarkdown = (
  params: OperationVideoDocumentParams
): string => {
  const seconds = durationSeconds(params.durationMs);
  const description = params.description?.trim();
  return nonEmptyLines([
    `# Operation Journey: ${params.title}`,
    "",
    "この文書は StoryVault のユーザーストーリー生成で参照する、ザッピング動画由来の検索用ジャーニー証跡です。",
    "",
    "## Application",
    `- Name: ${params.application.name}`,
    `- Application ID: ${params.application.id}`,
    `- Application Key: ${params.application.applicationKey}`,
    `- Repository: ${params.application.repoFullName}`,
    params.application.startUrl ? `- Start URL: ${params.application.startUrl}` : "",
    "",
    "## Operation Context",
    `- Video ID: ${params.videoId}`,
    `- Title: ${params.title}`,
    `- Recorded At: ${params.recordedAt}`,
    `- Display Surface: ${params.sourceDisplaySurface ?? "unknown"}`,
    seconds !== null ? `- Duration: ${seconds} seconds` : "",
    description ? `- User Notes: ${description}` : "- User Notes: 未記入",
    params.tags?.length ? `- Tags: ${params.tags.join(", ")}` : "",
    params.transcriptProvider
      ? `- Transcript Provider: ${params.transcriptProvider}`
      : "",
    "",
    params.quickScan?.title?.trim() ? "## AI Pre Analysis" : "",
    params.quickScan?.title?.trim() ? `- Title: ${params.quickScan.title.trim()}` : "",
    params.quickScan?.description?.trim()
      ? `- Description: ${params.quickScan.description.trim()}`
      : "",
    params.quickScan?.operationSteps?.length ? "" : "",
    params.quickScan?.operationSteps?.length ? "## Operation Steps" : "",
    ...numberedLines(params.quickScan?.operationSteps),
    params.quickScan?.operationMemo?.trim() ? "" : "",
    params.quickScan?.operationMemo?.trim() ? "## Operation Memo" : "",
    params.quickScan?.operationMemo?.trim() || "",
    params.frameCaptures?.length ? "" : "",
    params.frameCaptures?.length ? "## Frame Captures" : "",
    ...frameLines(params.frameCaptures),
    params.frameCaptures?.length ? "" : "",
    params.transcriptSummary?.trim() ? "## Spoken Summary" : "",
    params.transcriptSummary?.trim() || "",
    params.transcriptSummary?.trim() ? "" : "",
    params.transcriptSrt?.trim() ? "## Timestamped Spoken Transcript (SRT)" : "",
    params.transcriptSrt?.trim() || "",
    params.transcriptSrt?.trim() ? "" : "",
    params.transcriptText?.trim() ? "## Spoken Transcript" : "",
    params.transcriptText?.trim() || "",
    params.transcriptText?.trim() ? "" : "",
    "## User Goal Inference",
    params.transcriptSummary?.trim() ||
      params.transcriptText?.trim() ||
      description ||
      "録画タイトルと画面操作から、後続の Capability / Story Agent がユーザー目的を推定してください。",
    "",
    "## Potential Evidence Usage",
    "- Capability 候補の境界決定",
    "- ユーザー操作順序の確認",
    "- Story / Acceptance Criteria の導出",
    "- スクリーンショットや GitHub 実装との差分確認",
    "",
    "## Original Media",
    `- Bucket: ${params.bucketName}`,
    `- Storage Path: ${params.storagePath}`,
    `- Content Type: ${params.contentType}`,
    `- Size Bytes: ${params.sizeBytes}`,
  ]).join("\n");
};
