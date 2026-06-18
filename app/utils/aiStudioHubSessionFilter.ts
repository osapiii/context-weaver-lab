import type { AiStudioSessionListItem } from "@composables/useAiStudioSessions";

export type AiStudioCompletionFilter = "all" | "incomplete" | "completed";

export const hasStartedAiStudioSession = (
  session: Pick<AiStudioSessionListItem, "messageCount">
): boolean => session.messageCount > 0;

export const matchesAiStudioCompletionFilter = (
  session: Pick<AiStudioSessionListItem, "status">,
  filter: AiStudioCompletionFilter
): boolean => {
  if (filter === "all") return true;
  const isCompleted = session.status === "completed";
  return filter === "completed" ? isCompleted : !isCompleted;
};
