import { describe, expect, it } from "vitest";
import {
  buildOperationVideoJourneyMarkdown,
  buildOperationVideoMetadataMarkdown,
} from "./storyVaultEvidenceDocuments";

const baseParams = {
  application: {
    id: "app-1",
    applicationKey: "APP",
    name: "Example App",
    repoFullName: "enostech/example",
    startUrl: "https://example.com/app",
  },
  videoId: "operation-video-1",
  title: "Create workspace flow",
  description: "User creates a new workspace and invites a teammate.",
  bucketName: "storage-bucket",
  storagePath:
    "organizations/org/spaces/space/storyVault/applications/app-1/videos/demo.webm",
  contentType: "video/webm",
  sizeBytes: 1024,
  durationMs: 123_400,
  recordedAt: "2026-06-22T00:00:00.000Z",
  sourceDisplaySurface: "browser" as const,
};

describe("storyVaultEvidenceDocuments", () => {
  it("builds operation video metadata markdown with storage and app context", () => {
    const markdown = buildOperationVideoMetadataMarkdown(baseParams);

    expect(markdown).toContain("# Create workspace flow");
    expect(markdown).toContain("Application ID: app-1");
    expect(markdown).toContain("Repository: enostech/example");
    expect(markdown).toContain("Duration: 123 seconds");
    expect(markdown).toContain(baseParams.storagePath);
  });

  it("builds operation journey markdown for story generation evidence", () => {
    const markdown = buildOperationVideoJourneyMarkdown(baseParams);

    expect(markdown).toContain("# Operation Journey: Create workspace flow");
    expect(markdown).toContain("User Goal Inference");
    expect(markdown).toContain("User creates a new workspace");
    expect(markdown).toContain("Story / Acceptance Criteria");
    expect(markdown).toContain("Original Media");
  });
});
