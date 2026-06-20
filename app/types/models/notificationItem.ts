import { z } from "zod";
import type {
  WorkflowItem,
  WorkflowItemNavigateTarget,
  WorkflowItemStatus,
} from "./workflowItem";
import type { EnAiStudioActiveTask } from "./enAiStudioSessionState";
import type { UserWorkflowRequestLogType } from "@utils/workflowItemRegistry";

export interface NotificationItem {
  id: string;
  title: string;
  jobType: string;
  jobTypeLabel: string;
  status: WorkflowItemStatus;
  destination?: WorkflowItemNavigateTarget;
  createdAt: Date;
  updatedAt: Date;
  sourceWorkflowItem: WorkflowItem;
}

export const NotificationEmailSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  email: z.string().email().optional().or(z.literal("")),
  jobTypeSettings: z.record(z.boolean()).default({}),
});

export type NotificationEmailSettings = z.infer<
  typeof NotificationEmailSettingsSchema
>;

export interface NotificationReadState {
  notificationId: string;
  readAt: Date;
}

export type NotificationJobType =
  | UserWorkflowRequestLogType
  | EnAiStudioActiveTask;
