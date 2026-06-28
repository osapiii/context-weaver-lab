import { describe, expect, it } from "vitest";
import { DecodedVibeControlOperationVideoSchema } from "./vibeControl";

const baseVideo = {
  id: "video-1",
  applicationId: "app-1",
  applicationKey: "APP",
  title: "AIにファイルを取り込ませる",
  fileName: "video.webm",
  bucketName: "bucket",
  storagePath: "videos/video.webm",
  contentType: "video/webm",
  sizeBytes: 123,
  frameCaptures: [],
  tags: [],
  recordedAt: "2026-06-28T00:00:00.000Z",
};

describe("VibeControl operation video relatedContexts", () => {
  it("decodes existing videos without relatedContexts", () => {
    const parsed = DecodedVibeControlOperationVideoSchema.parse(baseVideo);

    expect(parsed.relatedContexts).toBeUndefined();
  });

  it("decodes GitHub related PR results", () => {
    const parsed = DecodedVibeControlOperationVideoSchema.parse({
      ...baseVideo,
      relatedContexts: {
        generatedAt: "2026-06-28T00:00:00.000Z",
        status: "completed",
        github: {
          repoFullName: "enostech/app",
          checkedAt: "2026-06-28T00:00:00.000Z",
          pullRequests: [
            {
              number: 12,
              title: "Add zapping import",
              htmlUrl: "https://github.com/enostech/app/pull/12",
              relevanceScore: 91,
              reason: "動画の投げ込み操作とPRタイトルが一致しています。",
              matchedSignals: ["投げ込み", "zapping"],
            },
          ],
        },
      },
    });

    expect(parsed.relatedContexts?.github?.pullRequests[0]?.number).toBe(12);
    expect(parsed.relatedContexts?.github?.pullRequests[0]?.matchedSignals).toEqual([
      "投げ込み",
      "zapping",
    ]);
  });

  it("decodes Slack related message results", () => {
    const parsed = DecodedVibeControlOperationVideoSchema.parse({
      ...baseVideo,
      relatedContexts: {
        generatedAt: "2026-06-28T00:00:00.000Z",
        status: "completed",
        slack: {
          teamId: "T123",
          teamName: "ENOSTECH",
          checkedAt: "2026-06-28T00:00:00.000Z",
          messages: [
            {
              channelId: "C123",
              channelName: "product",
              messageTs: "1782640000.000100",
              permalink: "https://example.slack.com/archives/C123/p1782640000000100",
              text: "Google Drive同期の取り込みを改善しました",
              relevanceScore: 88,
              reason: "動画のGoogle Drive同期操作と投稿本文が一致しています。",
              matchedSignals: ["Google Drive同期"],
            },
          ],
        },
      },
    });

    expect(parsed.relatedContexts?.slack?.messages[0]?.channelName).toBe("product");
  });
});
