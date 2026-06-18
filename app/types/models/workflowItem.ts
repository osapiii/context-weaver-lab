/**
 * ワークフロー実行ダッシュボード用の共通アイテム型.
 * ADK session (adkSessions) / GCP Workflow request doc (requests/*) を
 * `convertToWorkflowItemsFormat` で本型に正規化して画面表示する.
 */

import { z } from "zod";
import type { Timestamp } from "firebase/firestore";
import type { EnAiStudioSessionState } from "./enAiStudioSessionState";

export const WorkflowItemSourceKindEnum = z.enum([
  "adkSession",
  "workflowRequest",
]);
export type WorkflowItemSourceKind = z.infer<
  typeof WorkflowItemSourceKindEnum
>;

export const WorkflowItemStatusEnum = z.enum([
  "pending",
  "running",
  "completed",
  "error",
]);
export type WorkflowItemStatus = z.infer<typeof WorkflowItemStatusEnum>;

export interface WorkflowItemNavigateTarget {
  routeName: string;
  query?: Record<string, string>;
  params?: Record<string, string>;
}

export interface WorkflowItem {
  id: string;
  /** 同一実行を session.state / RequestDoc 間で重複排除するための識別子 */
  executionId?: string;
  sourceKind: WorkflowItemSourceKind;
  /** ADK: EnAiStudioActiveTask (image/writing/...) / Workflow: LogType */
  itemType: string;
  label: string;
  color: string;
  status: WorkflowItemStatus;
  createdAt: Date;
  updatedAt: Date;
  /** 補足メッセージ (例: タイトル、エラー概要) */
  progressLabel?: string;
  errorMessage?: string;
  navigateTarget?: WorkflowItemNavigateTarget;
  originalDoc: unknown;
}

/** adkSessions コレクションのドキュメント (一覧変換に必要な部分のみ) */
export interface AdkSessionWorkflowSourceDoc {
  id: string;
  title?: string | null;
  createdAt?: Timestamp | Date | string | null;
  updatedAt?: Timestamp | Date | string | null;
  state?: EnAiStudioSessionState | null;
}
