import type {
  DecodedVibeControlApplication,
  VibeControlOperationVideoDisplaySurface,
} from "@models/vibeControl";

type OperationVideoDocumentParams = {
  application: Pick<
    DecodedVibeControlApplication,
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
  sourceDisplaySurface?: VibeControlOperationVideoDisplaySurface;
};

const durationSeconds = (durationMs?: number): number | null =>
  typeof durationMs === "number" ? Math.round(durationMs / 1000) : null;

const nonEmptyLines = (lines: Array<string | false | null | undefined>): string[] =>
  lines.filter((line): line is string => typeof line === "string" && line !== "");

export const buildOperationVideoMetadataMarkdown = (
  params: OperationVideoDocumentParams
): string => {
  const seconds = durationSeconds(params.durationMs);
  return nonEmptyLines([
    `# ${params.title}`,
    "",
    params.description?.trim() || "操作動画のメタデータです。",
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
    "",
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
    "この文書は VibeControl のユーザーストーリー生成で参照する、操作動画由来の検索用ジャーニー証跡です。",
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
    "",
    "## User Goal Inference",
    description || "録画タイトルと画面操作から、後続の Capability / Story Agent がユーザー目的を推定してください。",
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
