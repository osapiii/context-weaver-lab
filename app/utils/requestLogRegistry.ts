import { googleSheetDataFetchRequestConverter, googleSheetValidateRequestConverter } from "@models/googleSheet";
import { fileSpaceOperationRequestConverter } from "@models/geminiFileSpaceRequest";
import { webCrawlRequestConverter } from "@models/webCrawlRequest";
import { googleDriveSyncRequestConverter } from "@models/googleDriveSyncRequest";
import { enAiStudioSyncRequestConverter } from "@models/enAiStudioSyncRequest";
import { adkInvokeRequestConverter } from "@models/adkInvokeRequest";
import { transactionalEmailRequestConverter } from "@models/transactionalEmailRequest";
import { adminUserCreateRequestConverter } from "@models/adminUserCreateRequest";
import { saasOnboardingRequestConverter } from "@models/saasOnboardingRequest";
import {
  memberUserCreateRequestConverter,
  memberUserUpdateRequestConverter,
  memberUserDeleteRequestConverter,
} from "@models/organizationMemberRequest";

export type RequestLogScope = "space" | "organization";

export type RequestLogRegistryEntry = {
  type: string;
  label: string;
  collectionPath: string;
  scope: RequestLogScope;
  color: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  converter?: any;
};

/**
 * EN AIstudio アプリ内の RequestDoc ログコレクション一覧（監査ビューア用）
 */
export const REQUEST_LOG_REGISTRY = [
  {
    type: "googleSheetDataFetchRequest",
    label: "Gシートデータ取得",
    collectionPath: "requests/googleSheetDataFetchRequests/logs",
    scope: "space",
    color: "#6366f1",
    converter: googleSheetDataFetchRequestConverter,
  },
  {
    type: "googleSheetValidateRequest",
    label: "Gシート検証",
    collectionPath: "requests/googleSheetValidateRequests/logs",
    scope: "space",
    color: "#8b5cf6",
    converter: googleSheetValidateRequestConverter,
  },
  {
    type: "contextStoreRequest",
    label: "Context Store (Agent Search)",
    collectionPath: "requests/contextStoreRequests/logs",
    scope: "space",
    color: "#06b6d4",
    converter: fileSpaceOperationRequestConverter,
  },
  {
    type: "adkInvokeRequest",
    label: "ADK エージェント会話",
    collectionPath: "requests/adkInvokeRequests/logs",
    scope: "space",
    color: "#7c3aed",
    converter: adkInvokeRequestConverter,
  },
  {
    type: "transactionalEmailRequest",
    label: "トランザクションメール",
    collectionPath: "requests/transactionalEmailRequests/logs",
    scope: "space",
    color: "#64748b",
    converter: transactionalEmailRequestConverter,
  },
  {
    type: "webCrawlRequest",
    label: "Web Crawl",
    collectionPath: "requests/webCrawlRequests/logs",
    scope: "organization",
    color: "#14b8a6",
    converter: webCrawlRequestConverter,
  },
  {
    type: "googleDriveSyncRequest",
    label: "Google Drive 同期",
    collectionPath: "requests/googleDriveSyncRequests/logs",
    scope: "space",
    color: "#4285f4",
    converter: googleDriveSyncRequestConverter,
  },
  {
    type: "enAiStudioSyncRequest",
    label: "データ同期",
    collectionPath: "requests/enAiStudioSyncRequests/logs",
    scope: "space",
    color: "#ec4899",
    converter: enAiStudioSyncRequestConverter,
  },
  {
    type: "adminUserCreateRequest",
    label: "管理者ユーザー作成",
    collectionPath: "requests/adminUserCreate/logs",
    scope: "organization",
    color: "#64748b",
    converter: adminUserCreateRequestConverter,
  },
  {
    type: "saasOnboardingRequest",
    label: "SaaS オンボーディング (Godモード)",
    collectionPath: "requests/saasOnboarding/logs",
    scope: "organization",
    color: "#7c3aed",
    converter: saasOnboardingRequestConverter,
  },
  {
    type: "memberUserCreateRequest",
    label: "メンバー作成",
    collectionPath: "requests/memberUserCreate/logs",
    scope: "organization",
    color: "#0d9488",
    converter: memberUserCreateRequestConverter,
  },
  {
    type: "memberUserUpdateRequest",
    label: "メンバー更新",
    collectionPath: "requests/memberUserUpdate/logs",
    scope: "organization",
    color: "#0891b2",
    converter: memberUserUpdateRequestConverter,
  },
  {
    type: "memberUserDeleteRequest",
    label: "メンバー削除",
    collectionPath: "requests/memberUserDelete/logs",
    scope: "organization",
    color: "#dc2626",
    converter: memberUserDeleteRequestConverter,
  },
] as const satisfies readonly RequestLogRegistryEntry[];

export type LogType = (typeof REQUEST_LOG_REGISTRY)[number]["type"];

export const REQUEST_LOG_REGISTRY_BY_TYPE = Object.fromEntries(
  REQUEST_LOG_REGISTRY.map((e) => [e.type, e])
) as Record<LogType, RequestLogRegistryEntry>;

/** GCP Workflows 連携 RequestDoc（input artifact が GCS/FBS SSOT） */
export const WORKFLOW_REQUEST_LOG_TYPES = [
  "googleDriveSyncRequest",
  "webCrawlRequest",
] as const satisfies readonly LogType[];

export type WorkflowRequestLogType =
  (typeof WORKFLOW_REQUEST_LOG_TYPES)[number];

export function isWorkflowRequestLogType(
  type: string
): type is WorkflowRequestLogType {
  return (WORKFLOW_REQUEST_LOG_TYPES as readonly string[]).includes(type);
}
