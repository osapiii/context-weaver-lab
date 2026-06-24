/**
 * ワークフロー実行ダッシュボード (実行ジョブ一覧) 向けの対象種別定義.
 * REQUEST_LOG_REGISTRY のうち「ユーザー操作起点」のものだけを抜粋する
 * (管理者専用 CRUD / オンボーディングは対象外).
 */

import type { EnAiStudioActiveTask } from "@models/enAiStudioSessionState";
import { REQUEST_LOG_REGISTRY_BY_TYPE, type LogType } from "./requestLogRegistry";

/** ユーザー操作起点で実行される GCP Workflow / RequestDoc 種別 */
export const USER_WORKFLOW_REQUEST_LOG_TYPES = [
  "adkInvokeRequest",
  "googleDriveSyncRequest",
  "webCrawlRequest",
] as const satisfies readonly LogType[];

export type UserWorkflowRequestLogType =
  (typeof USER_WORKFLOW_REQUEST_LOG_TYPES)[number];

export function isUserWorkflowRequestLogType(
  type: string
): type is UserWorkflowRequestLogType {
  return (USER_WORKFLOW_REQUEST_LOG_TYPES as readonly string[]).includes(
    type
  );
}

/** ADK タスク種別ごとの表示ラベル (EnAiStudioActiveTask) */
export const ADK_TASK_LABELS: Record<EnAiStudioActiveTask, string> = {
  image: "画像生成",
  writing: "文書生成",
  consultation: "経営相談",
  research: "リサーチ",
  business_partner: "取引先登録",
  guide: "ガイド",
  sheet: "シート編集",
  data_analysis: "データ分析",
  web_page: "WEBページ",
  application_scan: "Screen Atlas",
  vibe_capability_structuring: "Capability解析",
  vibe_story_generation: "Story生成",
};

/** ADK セッションのバッジ色 (CLAUDE.md の AI = violet 規約に準拠) */
export const ADK_TASK_COLOR =
  REQUEST_LOG_REGISTRY_BY_TYPE.adkInvokeRequest.color;

export function getAdkTaskLabel(taskType: EnAiStudioActiveTask): string {
  return ADK_TASK_LABELS[taskType] ?? taskType;
}

export function getWorkflowRequestLabel(type: UserWorkflowRequestLogType): string {
  return REQUEST_LOG_REGISTRY_BY_TYPE[type].label;
}

export function getWorkflowRequestColor(type: UserWorkflowRequestLogType): string {
  return REQUEST_LOG_REGISTRY_BY_TYPE[type].color;
}
