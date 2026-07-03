import type {
  DecodedStoryVaultOperationVideo,
  DecodedStoryVaultStory,
} from "@models/storyVault";

export const USER_STORY_KEY_PREFIX = "US";

export function formatUserStoryKey(sequence: number): string {
  const safeSequence = Math.max(1, Math.floor(sequence));
  return `${USER_STORY_KEY_PREFIX}-${String(safeSequence).padStart(2, "0")}`;
}

export function parseUserStoryKeySequence(key: string | undefined): number {
  const match = key?.trim().match(/^US-?(\d+)$/i);
  return match ? Number(match[1]) : 0;
}

export function storyTicketKey(story: Pick<DecodedStoryVaultStory, "storyKey" | "sequence">): string {
  const explicitSequence = parseUserStoryKeySequence(story.storyKey);
  if (explicitSequence > 0) return formatUserStoryKey(explicitSequence);
  return formatUserStoryKey(story.sequence || 1);
}

export function nextUserStorySequenceForApplication(params: {
  applicationId: string;
  stories: DecodedStoryVaultStory[];
  operationVideos: DecodedStoryVaultOperationVideo[];
}): number {
  const sequences = [
    ...params.stories
      .filter((story) => story.applicationId === params.applicationId)
      .map((story) =>
        Math.max(parseUserStoryKeySequence(story.storyKey), story.sequence || 0)
      ),
    ...params.operationVideos
      .filter((video) => video.applicationId === params.applicationId)
      .flatMap((video) =>
        (video.analysisResult?.storyCandidates ?? []).map((candidate) =>
          parseUserStoryKeySequence(candidate.storyKey)
        )
      ),
  ];
  return Math.max(0, ...sequences) + 1;
}
